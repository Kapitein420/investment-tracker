"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { StageStatusValue } from "@prisma/client";

// Stage unlock rules:
// - teaser: always unlocked
// - nda: unlocked if teaser is COMPLETED
// - im: unlocked if nda has approvedAt set
// - viewing: unlocked if im is COMPLETED
// - nbo: unlocked if viewing is COMPLETED
const STAGE_UNLOCK_RULES: Record<
  string,
  (stages: Map<string, { status: string; approvedAt: Date | null }>) => boolean
> = {
  teaser: () => true,
  nda: (stages) => stages.get("teaser")?.status === "COMPLETED",
  im: (stages) => stages.get("nda")?.approvedAt != null,
  viewing: (stages) => stages.get("im")?.status === "COMPLETED",
  nbo: (stages) => stages.get("viewing")?.status === "COMPLETED",
};

function computeUnlockedStages(
  stageStatuses: Array<{
    stage: { key: string };
    status: string;
    approvedAt: Date | null;
  }>
): Record<string, boolean> {
  const stageMap = new Map(
    stageStatuses.map((ss) => [
      ss.stage.key,
      { status: ss.status, approvedAt: ss.approvedAt },
    ])
  );

  const unlocked: Record<string, boolean> = {};
  for (const [key, rule] of Object.entries(STAGE_UNLOCK_RULES)) {
    unlocked[key] = rule(stageMap);
  }

  return unlocked;
}

export async function getInvestorDeals() {
  const user = await requireUser();

  if (user.role !== "INVESTOR") {
    throw new Error("Forbidden: investor access only");
  }

  if (!user.companyId) {
    throw new Error("Investor has no associated company");
  }

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: { companyId: user.companyId },
    include: {
      asset: true,
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
      documents: {
        include: {
          stage: true,
          signingTokens: {
            where: { usedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return trackings.map((tracking) => ({
    ...tracking,
    unlockedStages: computeUnlockedStages(tracking.stageStatuses),
  }));
}

export type InvestorStageEvent = "OPENED" | "VIEWED_DOCUMENT" | "DOWNLOADED";

// Monotonic ordering — we only allow transitions forward through this chain.
const STATUS_RANK: Record<StageStatusValue, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  BLOCKED: 1,
  DECLINED: 1,
  COMPLETED: 2,
};

/**
 * Given the investor's raw action on a stage, compute the next status the
 * stage should transition to, or null if this event is a no-op for that
 * stage. We never regress — the caller also guards against it.
 */
function nextStatusForEvent(
  stageKey: string,
  event: InvestorStageEvent,
  current: StageStatusValue
): StageStatusValue | null {
  const key = stageKey.toLowerCase();

  if (event === "OPENED" && key === "teaser") {
    // Opening the teaser landing page is equivalent to consuming it.
    if (current === "NOT_STARTED" || current === "IN_PROGRESS") return "COMPLETED";
    return null;
  }

  if (event === "OPENED" && key === "nda") {
    // Defensive — invite seed should already have put NDA at IN_PROGRESS.
    if (current === "NOT_STARTED") return "IN_PROGRESS";
    return null;
  }

  if (event === "VIEWED_DOCUMENT" && key === "im") {
    if (current === "NOT_STARTED") return "IN_PROGRESS";
    return null;
  }

  if (event === "DOWNLOADED" && key === "im") {
    if (current === "NOT_STARTED" || current === "IN_PROGRESS") return "COMPLETED";
    return null;
  }

  return null;
}

/**
 * Record an investor-side stage event from the portal. Fire-and-forget from
 * the client — any validation failure is swallowed server-side so we never
 * block the UI on tracking data.
 *
 * Only the investor's own company's tracking can be mutated, and the status
 * only transitions forward (never regresses).
 */
export async function recordInvestorStageEvent(input: {
  trackingId: string;
  stageKey: string;
  event: InvestorStageEvent;
}): Promise<{ ok: boolean; transitioned: boolean }> {
  const user = await requireUser();

  if (user.role !== "INVESTOR") {
    // Only investors (or the internal admin impersonating one) fire these.
    // Admins viewing via /portal with a companyId are allowed too.
    if (user.role !== "ADMIN") return { ok: false, transitioned: false };
  }

  if (!user.companyId) return { ok: false, transitioned: false };

  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: { id: input.trackingId },
    select: { id: true, companyId: true, assetId: true },
  });

  if (!tracking) return { ok: false, transitioned: false };
  if (tracking.companyId !== user.companyId) {
    return { ok: false, transitioned: false };
  }

  const stageStatus = await prisma.stageStatus.findFirst({
    where: {
      trackingId: tracking.id,
      stage: { key: { equals: input.stageKey, mode: "insensitive" } },
    },
    include: { stage: true },
  });

  if (!stageStatus) return { ok: false, transitioned: false };

  const next = nextStatusForEvent(
    stageStatus.stage.key,
    input.event,
    stageStatus.status
  );

  if (!next) return { ok: true, transitioned: false };

  // Guard against regression (belt + suspenders with nextStatusForEvent).
  if (STATUS_RANK[next] <= STATUS_RANK[stageStatus.status]) {
    return { ok: true, transitioned: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.stageStatus.update({
      where: { id: stageStatus.id },
      data: {
        status: next,
        updatedByUserId: user.id,
        completedAt: next === "COMPLETED" ? new Date() : stageStatus.completedAt,
      },
    });

    await tx.stageHistory.create({
      data: {
        trackingId: tracking.id,
        stageId: stageStatus.stageId,
        fieldName: "status",
        oldValue: stageStatus.status,
        newValue: next,
        changedByUserId: user.id,
        note: `investor:${input.event}`,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "StageStatus",
        entityId: stageStatus.id,
        action: "INVESTOR_STAGE_EVENT",
        metadata: {
          trackingId: tracking.id,
          assetId: tracking.assetId,
          stageKey: stageStatus.stage.key,
          event: input.event,
          from: stageStatus.status,
          to: next,
        },
        userId: user.id,
      },
    });
  });

  return { ok: true, transitioned: true };
}

export async function getAssetContentForInvestor(
  assetId: string,
  stageKey: string
) {
  const user = await requireUser();

  if (user.role !== "INVESTOR") {
    throw new Error("Forbidden: investor access only");
  }

  if (!user.companyId) {
    throw new Error("Investor has no associated company");
  }

  // Verify the investor's company has a tracking for this asset
  const tracking = await prisma.assetCompanyTracking.findFirst({
    where: {
      assetId,
      companyId: user.companyId,
    },
    include: {
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
    },
  });

  if (!tracking) {
    throw new Error("No access to this asset");
  }

  // Verify the stage is unlocked
  const unlocked = computeUnlockedStages(tracking.stageStatuses);
  if (!unlocked[stageKey]) {
    throw new Error("This stage is not yet unlocked");
  }

  // For gated stages (im), additionally check approvedAt
  if (stageKey === "im") {
    const ndaStatus = tracking.stageStatuses.find(
      (ss) => ss.stage.key === "nda"
    );
    if (!ndaStatus?.approvedAt) {
      throw new Error("NDA approval required to access IM content");
    }
  }

  const content = await prisma.assetContent.findMany({
    where: {
      assetId,
      stageKey,
      isPublished: true,
    },
  });

  return content.length > 0 ? content : null;
}
