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
