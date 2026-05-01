"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { getAppUrl } from "@/lib/app-url";
import { syncCurrentStageKeyAfterCommit } from "@/actions/tracking-actions";

export async function approveStage(trackingId: string, stageKey: string) {
  const user = await requireRole("EDITOR");

  const result = await prisma.$transaction(async (tx) => {
    const stageStatus = await tx.stageStatus.findFirstOrThrow({
      where: {
        trackingId,
        stage: { key: stageKey },
      },
      include: { stage: true },
    });

    await tx.stageStatus.update({
      where: { id: stageStatus.id },
      data: {
        approvedAt: new Date(),
        approvedByUserId: user.id,
      },
    });

    // When NDA is approved, the IM is now in the investor's hands —
    // mark IM as COMPLETED so the admin's overview reflects "they have
    // access to it" rather than waiting for an actual download to flip
    // the green check (downloads still get logged as timeline events
    // via recordInvestorStageEvent, just no longer drive completion).
    // Teaser is also defensively completed for offline-signed NDAs that
    // get uploaded before the investor ever opens the portal.
    if (stageKey === "nda") {
      const imStageStatus = await tx.stageStatus.findFirst({
        where: {
          trackingId,
          stage: { key: "im" },
        },
      });

      if (imStageStatus && imStageStatus.status !== "COMPLETED") {
        await tx.stageStatus.update({
          where: { id: imStageStatus.id },
          data: {
            status: "COMPLETED",
            completedAt: imStageStatus.completedAt ?? new Date(),
            updatedByUserId: user.id,
          },
        });
        await tx.stageHistory.create({
          data: {
            trackingId,
            stageId: imStageStatus.stageId,
            fieldName: "status",
            oldValue: imStageStatus.status,
            newValue: "COMPLETED",
            changedByUserId: user.id,
            note: "auto:nda-approved",
          },
        });
      }

      const teaserStageStatus = await tx.stageStatus.findFirst({
        where: {
          trackingId,
          stage: { key: "teaser" },
        },
      });

      if (teaserStageStatus && teaserStageStatus.status !== "COMPLETED") {
        await tx.stageStatus.update({
          where: { id: teaserStageStatus.id },
          data: {
            status: "COMPLETED",
            completedAt: teaserStageStatus.completedAt ?? new Date(),
            updatedByUserId: user.id,
          },
        });
      }
    }

    await tx.stageHistory.create({
      data: {
        trackingId,
        stageId: stageStatus.stageId,
        fieldName: "approval",
        oldValue: null,
        newValue: "APPROVED",
        changedByUserId: user.id,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "StageStatus",
        entityId: stageStatus.id,
        action: "STAGE_APPROVED",
        metadata: {
          trackingId,
          stageKey,
        },
        userId: user.id,
      },
    });

    const tracking = await tx.assetCompanyTracking.findUniqueOrThrow({
      where: { id: trackingId },
    });

    return tracking;
  });

  // POST-COMMIT: roll currentStageKey forward and auto-complete any
  // earlier stages that are still NOT_STARTED.
  await syncCurrentStageKeyAfterCommit(trackingId);

  revalidatePath(`/assets/${result.assetId}`);
  revalidatePath(`/portal`);

  // Send approval notification email to the investor.
  //
  // Recipient resolution covers three sources because no single one is
  // guaranteed to have the right address:
  //   1. The actual NDA document's signedByEmail — most accurate, that's
  //      who proved they read it.
  //   2. Users linked via UserCompanyMembership (the multi-company shim
  //      added in Sprint B). The legacy company.users relation only
  //      catches User.companyId scalar, so investors invited via the
  //      newer membership flow never showed up there — silent
  //      "approval emailed nothing" failure with no Mailgun log.
  //   3. Legacy company.users (User.companyId scalar) — fallback for
  //      pre-membership-shim accounts.
  // We dedupe and send to all unique addresses.
  if (stageKey === "nda") {
    try {
      const tracking = await prisma.assetCompanyTracking.findUnique({
        where: { id: trackingId },
        include: {
          asset: true,
          company: {
            include: {
              users: { where: { role: "INVESTOR" }, select: { email: true } },
            },
          },
          documents: {
            where: { stage: { key: "nda" }, status: "SIGNED" },
            orderBy: { signedAt: "desc" },
            take: 1,
            select: { signedByEmail: true },
          },
        },
      });

      if (!tracking) {
        console.warn(`[approveStage:email] tracking ${trackingId} not found`);
      } else {
        const memberships = await prisma.userCompanyMembership.findMany({
          where: {
            companyId: tracking.companyId,
            user: { role: "INVESTOR", isActive: true },
          },
          select: { user: { select: { email: true } } },
        });

        const recipients = new Set<string>();
        const signedByEmail = tracking.documents[0]?.signedByEmail;
        if (signedByEmail) recipients.add(signedByEmail.toLowerCase());
        for (const u of tracking.company.users) {
          if (u.email) recipients.add(u.email.toLowerCase());
        }
        for (const m of memberships) {
          if (m.user.email) recipients.add(m.user.email.toLowerCase());
        }

        if (recipients.size === 0) {
          console.warn(
            `[approveStage:email] no recipients found for tracking ${trackingId} ` +
              `(company=${tracking.companyId}) — nothing emailed`
          );
        } else {
          const { sendEmail } = await import("@/lib/email");
          const { renderEmail, renderCta } = await import("@/lib/email-template");
          const html = renderEmail({
            heading: "Your NDA has been approved",
            bodyHtml: `
              <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 16px 0;">
                Your NDA for <strong>${tracking.asset.title}</strong> has been reviewed and approved.
              </p>
              <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 24px 0;">
                You now have access to the Information Memorandum. Log in to your investor portal to review the materials.
              </p>
              ${renderCta("View Information Memorandum", `${getAppUrl()}/portal/${tracking.assetId}`)}
            `,
            meta: `${tracking.asset.title}`,
          });
          // Send in parallel; any individual failure is logged but doesn't
          // block the rest. The approval is already committed at this point.
          await Promise.allSettled(
            Array.from(recipients).map((to) =>
              sendEmail({
                to,
                subject: `NDA Approved — ${tracking.asset.title}`,
                html,
              })
            )
          );
          console.info(
            `[approveStage:email] sent NDA-approved to ${recipients.size} recipient(s) for tracking ${trackingId}`
          );
        }
      }
    } catch (e) {
      console.error("[approveStage:email] notification failed:", e);
    }
  }
}

export async function revokeStageApproval(
  trackingId: string,
  stageKey: string
) {
  const user = await requireRole("ADMIN");

  const result = await prisma.$transaction(async (tx) => {
    const stageStatus = await tx.stageStatus.findFirstOrThrow({
      where: {
        trackingId,
        stage: { key: stageKey },
      },
      include: { stage: true },
    });

    await tx.stageStatus.update({
      where: { id: stageStatus.id },
      data: {
        approvedAt: null,
        approvedByUserId: null,
      },
    });

    await tx.stageHistory.create({
      data: {
        trackingId,
        stageId: stageStatus.stageId,
        fieldName: "approval",
        oldValue: "APPROVED",
        newValue: "REVOKED",
        changedByUserId: user.id,
      },
    });

    const tracking = await tx.assetCompanyTracking.findUniqueOrThrow({
      where: { id: trackingId },
    });

    return tracking;
  });

  await syncCurrentStageKeyAfterCommit(trackingId);

  revalidatePath(`/assets/${result.assetId}`);
  revalidatePath(`/portal`);
}
