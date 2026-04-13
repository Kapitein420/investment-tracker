"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import {
  createTrackingSchema,
  updateTrackingSchema,
  updateStageStatusSchema,
  type CreateTrackingInput,
  type UpdateTrackingInput,
  type UpdateStageStatusInput,
} from "@/lib/validators";

export async function createTracking(data: CreateTrackingInput) {
  const user = await requireRole("EDITOR");
  const validated = createTrackingSchema.parse(data);

  const tracking = await prisma.$transaction(async (tx) => {
    const newTracking = await tx.assetCompanyTracking.create({
      data: {
        assetId: validated.assetId,
        companyId: validated.companyId,
        relationshipType: validated.relationshipType ?? "Investor",
        interestLevel: validated.interestLevel ?? null,
        ownerUserId: validated.ownerUserId ?? null,
      },
    });

    // Create StageStatus records for all active pipeline stages
    const activeStages = await tx.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { sequence: "asc" },
    });

    if (activeStages.length > 0) {
      await tx.stageStatus.createMany({
        data: activeStages.map((stage) => ({
          trackingId: newTracking.id,
          stageId: stage.id,
          status: "NOT_STARTED" as const,
        })),
      });
    }

    await tx.activityLog.create({
      data: {
        entityType: "AssetCompanyTracking",
        entityId: newTracking.id,
        action: "CREATED",
        metadata: {
          assetId: validated.assetId,
          companyId: validated.companyId,
        },
        userId: user.id,
      },
    });

    return newTracking;
  });

  revalidatePath(`/assets/${validated.assetId}`);
  return tracking;
}

export async function updateTracking(
  id: string,
  data: UpdateTrackingInput
) {
  const user = await requireRole("EDITOR");
  const validated = updateTrackingSchema.parse(data);

  const tracking = await prisma.$transaction(async (tx) => {
    const existing = await tx.assetCompanyTracking.findUniqueOrThrow({
      where: { id },
    });

    // Create StageHistory entries for each changed field
    const historyEntries: {
      trackingId: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      changedByUserId: string;
    }[] = [];

    for (const [key, newValue] of Object.entries(validated)) {
      if (newValue === undefined) continue;
      const oldValue = (existing as Record<string, unknown>)[key];
      if (String(oldValue ?? "") !== String(newValue ?? "")) {
        historyEntries.push({
          trackingId: id,
          fieldName: key,
          oldValue: oldValue != null ? String(oldValue) : null,
          newValue: newValue != null ? String(newValue) : null,
          changedByUserId: user.id,
        });
      }
    }

    if (historyEntries.length > 0) {
      await tx.stageHistory.createMany({ data: historyEntries });
    }

    return tx.assetCompanyTracking.update({
      where: { id },
      data: validated,
    });
  });

  revalidatePath(`/assets/${tracking.assetId}`);
  return tracking;
}

export async function deleteTracking(id: string) {
  const user = await requireRole("ADMIN");

  const tracking = await prisma.assetCompanyTracking.delete({
    where: { id },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "AssetCompanyTracking",
      entityId: id,
      action: "DELETED",
      metadata: {
        assetId: tracking.assetId,
        companyId: tracking.companyId,
      },
      userId: user.id,
    },
  });

  revalidatePath(`/assets/${tracking.assetId}`);
}

export async function updateStageStatus(data: UpdateStageStatusInput) {
  const user = await requireRole("EDITOR");
  const validated = updateStageStatusSchema.parse(data);

  const result = await prisma.$transaction(async (tx) => {
    // Update the StageStatus record
    const stageStatus = await tx.stageStatus.update({
      where: {
        trackingId_stageId: {
          trackingId: validated.trackingId,
          stageId: validated.stageId,
        },
      },
      data: {
        status: validated.status,
        completedAt:
          validated.status === "COMPLETED" ? new Date() : null,
        updatedByUserId: user.id,
      },
      include: { stage: true },
    });

    // Create a StageHistory entry
    await tx.stageHistory.create({
      data: {
        trackingId: validated.trackingId,
        stageId: validated.stageId,
        fieldName: "status",
        oldValue: null,
        newValue: validated.status,
        changedByUserId: user.id,
      },
    });

    // Derive currentStageKey: the highest-sequence stage that is IN_PROGRESS,
    // or the highest COMPLETED if none are IN_PROGRESS
    const allStatuses = await tx.stageStatus.findMany({
      where: { trackingId: validated.trackingId },
      include: { stage: true },
      orderBy: { stage: { sequence: "asc" } },
    });

    let derivedStageKey: string | null = null;
    const inProgress = allStatuses.filter(
      (s) => s.status === "IN_PROGRESS"
    );
    if (inProgress.length > 0) {
      derivedStageKey =
        inProgress[inProgress.length - 1].stage.key;
    } else {
      const completed = allStatuses.filter(
        (s) => s.status === "COMPLETED"
      );
      if (completed.length > 0) {
        derivedStageKey =
          completed[completed.length - 1].stage.key;
      }
    }

    const tracking = await tx.assetCompanyTracking.update({
      where: { id: validated.trackingId },
      data: { currentStageKey: derivedStageKey },
    });

    // Create activity log
    await tx.activityLog.create({
      data: {
        entityType: "StageStatus",
        entityId: stageStatus.id,
        action: "STATUS_UPDATED",
        metadata: {
          trackingId: validated.trackingId,
          stageKey: stageStatus.stage.key,
          newStatus: validated.status,
        },
        userId: user.id,
      },
    });

    return { stageStatus, tracking };
  });

  revalidatePath(`/assets/${result.tracking.assetId}`);
  return result.stageStatus;
}

export async function advanceToNextStage(trackingId: string) {
  const user = await requireRole("EDITOR");

  const result = await prisma.$transaction(async (tx) => {
    const tracking = await tx.assetCompanyTracking.findUniqueOrThrow({
      where: { id: trackingId },
    });

    const allStatuses = await tx.stageStatus.findMany({
      where: { trackingId },
      include: { stage: true },
      orderBy: { stage: { sequence: "asc" } },
    });

    // Find the current IN_PROGRESS stage
    const currentIndex = allStatuses.findIndex(
      (s) => s.status === "IN_PROGRESS"
    );

    if (currentIndex === -1) {
      // No stage in progress — start the first NOT_STARTED stage
      const firstNotStarted = allStatuses.find(
        (s) => s.status === "NOT_STARTED"
      );
      if (!firstNotStarted) {
        throw new Error("No stages available to advance");
      }

      await tx.stageStatus.update({
        where: { id: firstNotStarted.id },
        data: {
          status: "IN_PROGRESS",
          updatedByUserId: user.id,
        },
      });

      await tx.assetCompanyTracking.update({
        where: { id: trackingId },
        data: { currentStageKey: firstNotStarted.stage.key },
      });

      return { tracking, advancedTo: firstNotStarted.stage };
    }

    // Find the next stage by sequence
    const nextIndex = currentIndex + 1;
    if (nextIndex >= allStatuses.length) {
      throw new Error("Already at the final stage");
    }

    const currentStageStatus = allStatuses[currentIndex];
    const nextStageStatus = allStatuses[nextIndex];

    // Complete current stage
    await tx.stageStatus.update({
      where: { id: currentStageStatus.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        updatedByUserId: user.id,
      },
    });

    // Set next stage to IN_PROGRESS
    await tx.stageStatus.update({
      where: { id: nextStageStatus.id },
      data: {
        status: "IN_PROGRESS",
        updatedByUserId: user.id,
      },
    });

    // Update currentStageKey
    await tx.assetCompanyTracking.update({
      where: { id: trackingId },
      data: { currentStageKey: nextStageStatus.stage.key },
    });

    // History entries
    await tx.stageHistory.createMany({
      data: [
        {
          trackingId,
          stageId: currentStageStatus.stageId,
          fieldName: "status",
          oldValue: "IN_PROGRESS",
          newValue: "COMPLETED",
          changedByUserId: user.id,
        },
        {
          trackingId,
          stageId: nextStageStatus.stageId,
          fieldName: "status",
          oldValue: nextStageStatus.status,
          newValue: "IN_PROGRESS",
          changedByUserId: user.id,
        },
      ],
    });

    return { tracking, advancedTo: nextStageStatus.stage };
  });

  revalidatePath(`/assets/${result.tracking.assetId}`);
  return result.advancedTo;
}

export async function getTrackingDetail(id: string) {
  await requireUser();

  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: { id },
    include: {
      company: true,
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      stageHistory: {
        include: {
          changedBy: { select: { id: true, name: true, email: true } },
          stage: true,
        },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        include: {
          stage: true,
          uploadedBy: { select: { id: true, name: true } },
          signingTokens: {
            where: { usedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
      ownerUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!tracking) throw new Error("Tracking not found");
  return tracking;
}
