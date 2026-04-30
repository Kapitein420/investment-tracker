"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { getAppUrl } from "@/lib/app-url";
import { syncCurrentStageKey } from "@/actions/tracking-actions";

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

    // If NDA is approved, advance IM stage to IN_PROGRESS and (defensively)
    // mark the teaser as COMPLETED. The teaser normally completes when the
    // investor opens the asset, but an admin sometimes approves the NDA
    // out-of-band (signed offline, then uploaded) before the investor ever
    // logs in — leaving the teaser stuck NOT_STARTED in the journey UI.
    if (stageKey === "nda") {
      const imStageStatus = await tx.stageStatus.findFirst({
        where: {
          trackingId,
          stage: { key: "im" },
        },
      });

      if (imStageStatus) {
        await tx.stageStatus.update({
          where: { id: imStageStatus.id },
          data: {
            status: "IN_PROGRESS",
            updatedByUserId: user.id,
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

    // Roll currentStageKey forward so the pipeline-table dropdown reflects
    // the new state (NDA approved → IM IN_PROGRESS).
    await syncCurrentStageKey(tx, trackingId);

    const tracking = await tx.assetCompanyTracking.findUniqueOrThrow({
      where: { id: trackingId },
    });

    return tracking;
  });

  revalidatePath(`/assets/${result.assetId}`);
  revalidatePath(`/portal`);

  // Send approval notification email to investor
  try {
    // Find the company's investor user
    const tracking = await prisma.assetCompanyTracking.findUnique({
      where: { id: trackingId },
      include: {
        company: { include: { users: { where: { role: "INVESTOR" }, take: 1 } } },
        asset: true,
      },
    });

    if (tracking?.company.users[0]?.email) {
      const { sendEmail } = await import("@/lib/email");
      const { renderEmail, renderCta } = await import("@/lib/email-template");
      await sendEmail({
        to: tracking.company.users[0].email,
        subject: `NDA Approved — ${tracking.asset.title}`,
        html: renderEmail({
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
        }),
      });
    }
  } catch (e) {
    console.error("Approval notification email failed:", e);
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

  revalidatePath(`/assets/${result.assetId}`);
  revalidatePath(`/portal`);
}
