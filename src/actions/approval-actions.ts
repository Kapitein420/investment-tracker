"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

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

    // If NDA is approved, advance IM stage to IN_PROGRESS
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
      await sendEmail({
        to: tracking.company.users[0].email,
        subject: `NDA Approved — ${tracking.asset.title}`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #b8860b, #daa520); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">Investment Portal</h1>
            </div>
            <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1a1a1a; margin-top: 0;">Your NDA has been approved</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Good news — your NDA for <strong>${tracking.asset.title}</strong> has been reviewed and approved.
              </p>
              <p style="color: #4b5563; line-height: 1.6;">
                You now have access to the Information Memorandum. Log in to your investor portal to review the materials.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${process.env.NEXTAUTH_URL}/portal/${tracking.assetId}"
                   style="background: linear-gradient(135deg, #b8860b, #daa520); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                  View Information Memorandum
                </a>
              </div>
            </div>
          </div>
        `,
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
