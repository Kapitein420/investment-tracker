"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

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

  const loginUrl = `${getAppUrl()}/login`;

  try {
    await sendEmail({
      to: email,
      subject: `Your access to ${asset.title} — Investment Portal`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #b8860b, #daa520); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">Investment Portal</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #1a1a1a; margin-top: 0;">Welcome, ${company.name}</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              You have been granted access to review the investment opportunity
              <strong>${asset.title}</strong> in <strong>${asset.city}, ${asset.country}</strong>.
            </p>
            <p style="color: #4b5563; line-height: 1.6;">
              Use the credentials below to log in to your investor portal:
            </p>

            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #6b7280; padding: 6px 0; font-size: 14px; width: 80px;">Email</td>
                  <td style="color: #1a1a1a; padding: 6px 0; font-size: 14px; font-weight: 600;">${email}</td>
                </tr>
                ${plainPassword ? `
                <tr>
                  <td style="color: #6b7280; padding: 6px 0; font-size: 14px;">Password</td>
                  <td style="color: #1a1a1a; padding: 6px 0; font-size: 14px; font-weight: 600; font-family: monospace; letter-spacing: 1px;">${plainPassword}</td>
                </tr>
                ` : `
                <tr>
                  <td colspan="2" style="color: #6b7280; padding: 6px 0; font-size: 14px;">Use your existing password to log in</td>
                </tr>
                `}
              </table>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${loginUrl}"
                 style="background: linear-gradient(135deg, #b8860b, #daa520); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Log in to Portal
              </a>
            </div>

            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
              Keep these credentials secure. If you need assistance, contact the deal team directly.
            </p>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
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
