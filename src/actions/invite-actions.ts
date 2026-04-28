"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";
import { downloadFile, uploadBytes } from "@/lib/supabase-storage";
import { scanPlaceholders } from "@/lib/pdf-placeholder-scan";
import { cloneHtmlNdaForInvestor } from "@/actions/html-nda-actions";

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function sendInvestorInvite({
  companyId,
  assetId,
  email,
}: {
  companyId: string;
  assetId: string;
  email: string;
}) {
  const user = await requireRole("EDITOR");

  const [asset, company] = await Promise.all([
    prisma.asset.findUniqueOrThrow({ where: { id: assetId } }),
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
  ]);

  // Check if an INVESTOR user already exists for this company+email
  let investorUser = await prisma.user.findFirst({
    where: { email, companyId, role: "INVESTOR" },
  });

  let plainPassword: string | null = null;

  if (!investorUser) {
    // Auto-create investor account
    plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    investorUser = await prisma.user.create({
      data: {
        email,
        name: company.contactName || company.name,
        passwordHash,
        role: "INVESTOR",
        companyId,
      },
    });
  } else {
    // Check if investor has already logged in (any accepted invites)
    const hasLoggedIn = await prisma.investorInvite.findFirst({
      where: { email, companyId, acceptedAt: { not: null } },
    });

    if (!hasLoggedIn) {
      // Never logged in — safe to reset password
      plainPassword = generatePassword();
      const passwordHash = await bcrypt.hash(plainPassword, 12);
      await prisma.user.update({
        where: { id: investorUser.id },
        data: { passwordHash },
      });
    } else {
      // Already active — don't reset password, just send a reminder with login link
      plainPassword = null; // Will skip password display in email
    }
  }

  // Create invite record for tracking
  const token = randomUUID() + "-" + randomUUID();
  const invite = await prisma.investorInvite.create({
    data: {
      companyId,
      assetId,
      email,
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      // acceptedAt is set when the investor first logs in, not on creation
      createdById: user.id,
    },
  });

  // Ensure an AssetCompanyTracking exists for (asset, company) and that the
  // Teaser + NDA stages are already IN_PROGRESS so the investor sees them
  // unlocked the moment they log in. If a tracking already exists we leave
  // its stage statuses alone — someone has already started the deal.
  try {
    await prisma.$transaction(async (tx) => {
      const existingTracking = await tx.assetCompanyTracking.findUnique({
        where: { assetId_companyId: { assetId, companyId } },
      });

      if (existingTracking) return;

      const newTracking = await tx.assetCompanyTracking.create({
        data: {
          assetId,
          companyId,
          relationshipType: "Investor",
        },
      });

      const activeStages = await tx.pipelineStage.findMany({
        where: { isActive: true },
        orderBy: { sequence: "asc" },
      });

      // Case-insensitive key match so we're tolerant of seed casing drift
      const isEarlyStage = (key: string) => {
        const k = key.toLowerCase();
        return k === "teaser" || k === "nda";
      };

      if (activeStages.length > 0) {
        await tx.stageStatus.createMany({
          data: activeStages.map((stage) => ({
            trackingId: newTracking.id,
            stageId: stage.id,
            status: isEarlyStage(stage.key)
              ? ("IN_PROGRESS" as const)
              : ("NOT_STARTED" as const),
          })),
        });
      }

      await tx.activityLog.create({
        data: {
          entityType: "AssetCompanyTracking",
          entityId: newTracking.id,
          action: "CREATED_FROM_INVITE",
          metadata: {
            assetId,
            companyId,
            inviteId: invite.id,
            seededStages: ["teaser", "nda"],
          },
          userId: user.id,
        },
      });
    });
  } catch (e) {
    console.error("[sendInvestorInvite] Failed to seed tracking (invite still created):", e);
  }

  // Auto-clone the master NDA (AssetContent with stageKey "nda") into a
  // per-investor Document with its own SigningToken. Without this, the
  // investor never sees a "Sign Now" button because the portal only shows
  // per-tracking Documents, not the asset-level master PDF.
  try {
    const tracking = await prisma.assetCompanyTracking.findUnique({
      where: { assetId_companyId: { assetId, companyId } },
      select: { id: true },
    });
    if (!tracking) {
      throw new Error("tracking lookup failed after seed");
    }

    const ndaStage = await prisma.pipelineStage.findFirst({
      where: { key: { equals: "nda", mode: "insensitive" }, isActive: true },
      select: { id: true },
    });

    // Prefer HTML NDA when the admin has enabled it on this asset — it
    // bypasses the entire PDF/pdfjs/scanner stack and avoids per-PDF
    // template handling.
    const masterHtmlNda = await prisma.assetContent.findFirst({
      where: {
        assetId,
        contentType: "LANDING_PAGE",
        stageKey: { equals: "nda", mode: "insensitive" },
        keyMetrics: { path: ["isHtmlNda"], equals: true },
      },
      orderBy: { createdAt: "desc" },
    });

    if (masterHtmlNda && ndaStage) {
      await cloneHtmlNdaForInvestor(tracking.id, masterHtmlNda.id, user.id);
    }

    const masterNda = masterHtmlNda
      ? null
      : await prisma.assetContent.findFirst({
          where: {
            assetId,
            contentType: "PDF",
            stageKey: { equals: "nda", mode: "insensitive" },
            fileUrl: { not: null },
          },
          orderBy: { createdAt: "desc" },
        });

    // Only clone if we have a master NDA AND we don't already have a PENDING
    // Document for this tracking+stage (idempotent: resending invites won't
    // pile up duplicate sign-me-now docs).
    if (masterNda && masterNda.fileUrl && ndaStage) {
      const existingDoc = await prisma.document.findFirst({
        where: {
          trackingId: tracking.id,
          stageId: ndaStage.id,
          status: "PENDING",
        },
        select: { id: true },
      });

      if (!existingDoc) {
        const pdfBytes = await downloadFile(masterNda.fileUrl);
        const placeholderMap = (masterNda.placeholderMap as Record<string, unknown> | null)
          ?? (await scanPlaceholders(Buffer.from(pdfBytes)).catch(() => ({})));
        const keysFound = Object.keys(placeholderMap ?? {}).length;

        const safeName = (masterNda.fileName || "NDA.pdf").replace(/\s+/g, "_");
        const perInvestorPath = `documents/${tracking.id}/${Date.now()}-${safeName}`;
        const perInvestorUrl = await uploadBytes(
          pdfBytes,
          perInvestorPath,
          "application/pdf"
        );

        const doc = await prisma.document.create({
          data: {
            trackingId: tracking.id,
            stageId: ndaStage.id,
            fileName: masterNda.fileName || masterNda.title || "NDA.pdf",
            fileUrl: perInvestorUrl,
            fileSize: pdfBytes.length,
            mimeType: "application/pdf",
            status: "PENDING",
            placementMode: keysFound > 0 ? "PLACEHOLDER" : "GRID",
            placeholderMap: keysFound > 0 ? (placeholderMap as any) : undefined,
            uploadedByUserId: user.id,
          },
        });

        await prisma.signingToken.create({
          data: {
            documentId: doc.id,
            token: randomUUID() + "-" + randomUUID(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        await prisma.activityLog.create({
          data: {
            entityType: "Document",
            entityId: doc.id,
            action: "NDA_CLONED_FROM_MASTER",
            metadata: {
              assetId,
              companyId,
              trackingId: tracking.id,
              masterAssetContentId: masterNda.id,
              placeholderKeys: keysFound,
            },
            userId: user.id,
          },
        });
      }
    }
  } catch (e) {
    console.error(
      "[sendInvestorInvite] Failed to clone master NDA (invite still created):",
      e
    );
  }

  const loginUrl = `${getAppUrl()}/login`;

  try {
    await sendEmail({
      to: email,
      subject: `Your access to ${asset.title} — DILS Investment Portal`,
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFFFF;">
          <!-- Editorial header band -->
          <div style="background: #101820; padding: 28px 32px; text-align: left;">
            <div style="font-family: Georgia, 'Times New Roman', serif; color: #FFFFFF; font-size: 24px; letter-spacing: -0.5px; font-weight: 400; line-height: 1;">DILS</div>
            <div style="color: #FFFFFF; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; font-weight: 400;">Investment Portal</div>
          </div>
          <!-- Editorial red rule -->
          <div style="background: #EE2E24; height: 2px; line-height: 2px; font-size: 0;">&nbsp;</div>

          <!-- Body -->
          <div style="background: #FFFFFF; padding: 40px 32px 32px 32px;">
            <h1 style="font-family: Georgia, 'Times New Roman', serif; color: #101820; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; line-height: 1.2;">
              Welcome, ${company.name}
            </h1>
            <!-- Brass accent rule -->
            <div style="background: #AB8B5F; height: 2px; width: 40px; margin: 14px 0 24px 0; line-height: 2px; font-size: 0;">&nbsp;</div>

            <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 24px 0;">
              You have been granted access to review <strong>${asset.title}</strong> in ${asset.city}, ${asset.country}. Your credentials for the investor portal are below.
            </p>

            <!-- Credentials block: editorial, no rounded corners -->
            <table style="width: 100%; border: 1px solid #E6E8EB; border-collapse: collapse; margin: 0 0 28px 0;">
              <tr>
                <td style="padding: 14px 16px; width: 110px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #101820; font-weight: 700; border-bottom: 1px solid #E6E8EB;">Email</td>
                <td style="padding: 14px 16px; font-size: 14px; color: #101820; font-family: 'Courier New', Courier, monospace; background: #F5F6F7; border-bottom: 1px solid #E6E8EB;">${email}</td>
              </tr>
              ${plainPassword ? `
              <tr>
                <td style="padding: 14px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #101820; font-weight: 700;">Password</td>
                <td style="padding: 14px 16px; font-size: 14px; color: #101820; font-family: 'Courier New', Courier, monospace; letter-spacing: 1px; background: #F5F6F7;">${plainPassword}</td>
              </tr>
              ` : `
              <tr>
                <td colspan="2" style="padding: 14px 16px; font-size: 13px; color: #101820; background: #F5F6F7;">
                  Your existing password still works — use it to log back in.
                </td>
              </tr>
              `}
            </table>

            <!-- CTA -->
            <div style="margin: 0 0 32px 0;">
              <a href="${loginUrl}"
                 style="background: #101820; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: 700; display: inline-block; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, Helvetica, sans-serif;">
                Log in to portal
              </a>
            </div>

            <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0; border-top: 1px solid #E6E8EB; padding-top: 20px;">
              Keep these credentials secure. For assistance, reply to this email or contact the deal team directly.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #F5F6F7; padding: 14px 32px;">
            <p style="color: #6B7280; font-size: 10px; letter-spacing: 1px; margin: 0; text-transform: uppercase;">
              ${asset.title} &middot; ${asset.city}, ${asset.country}
            </p>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error("Email send failed (account still created):", e);
  }

  await prisma.activityLog.create({
    data: {
      entityType: "InvestorInvite",
      entityId: invite.id,
      action: "INVITE_SENT",
      metadata: {
        email,
        assetId,
        companyId,
        assetTitle: asset.title,
        companyName: company.name,
      },
      userId: user.id,
    },
  });

  revalidatePath("/admin/invites");
  revalidatePath(`/assets/${assetId}`);

  return invite;
}

export async function getInvites(assetId?: string) {
  await requireRole("EDITOR");

  const invites = await prisma.investorInvite.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      company: true,
      asset: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return invites;
}

/**
 * Remove an investor completely: delete every InvestorInvite they have for
 * the given company, then try to delete their User record. If the user is
 * still referenced elsewhere (comments, uploads, signed docs, tracking
 * ownership) we fall back to deactivating the account so the FK constraints
 * stay intact but they lose portal access.
 *
 * Returns a small summary the UI can toast.
 */
export async function removeInvestor({
  email,
  companyId,
}: {
  email: string;
  companyId: string;
}): Promise<{ invitesDeleted: number; userDeleted: boolean; userDeactivated: boolean }> {
  const actor = await requireRole("EDITOR");

  const result = await prisma.$transaction(async (tx) => {
    // Delete every invite for this investor+company
    const { count: invitesDeleted } = await tx.investorInvite.deleteMany({
      where: { email, companyId },
    });

    // Find the matching INVESTOR user (one per company+email)
    const investor = await tx.user.findFirst({
      where: { email, companyId, role: "INVESTOR" },
    });

    let userDeleted = false;
    let userDeactivated = false;

    if (investor) {
      try {
        await tx.user.delete({ where: { id: investor.id } });
        userDeleted = true;
      } catch {
        // FK violation — fall back to deactivate so admin can still recreate
        await tx.user.update({
          where: { id: investor.id },
          data: { isActive: false, email: `${investor.email}.removed-${Date.now()}` },
        });
        userDeactivated = true;
      }
    }

    return { invitesDeleted, userDeleted, userDeactivated };
  });

  await prisma.activityLog.create({
    data: {
      entityType: "InvestorInvite",
      entityId: "bulk",
      action: "INVESTOR_REMOVED",
      metadata: { email, companyId, ...result },
      userId: actor.id,
    },
  });

  revalidatePath("/admin/invites");
  return result;
}
