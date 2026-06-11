import { prisma } from "@/lib/db";

/**
 * Recompute and persist the canonical currentStageKey for a tracking
 * based on its StageStatus rows: highest-sequence IN_PROGRESS, fallback
 * highest COMPLETED. Skipped when the admin has manually pinned a stage
 * (currentStageManualOverride = true).
 *
 * IMPORTANT: this MUST be called from outside the parent transaction.
 * The earlier in-transaction version (PR #58, reverted by PR #61) caused
 * a single bad sync to roll back NDA signing. Now it's a best-effort
 * post-commit update — if it throws, the stage transition that triggered
 * it has already persisted; the column might just be stale on this row
 * until the next event fires.
 *
 * This lives in a plain server-side module (NOT a "use server" action
 * file) on purpose: it mutates StageStatus/currentStageKey for an
 * arbitrary trackingId and must only ever be reached through an already
 * authorized action, never as a directly-invokable endpoint.
 */
export async function syncCurrentStageKeyAfterCommit(
  trackingId: string
): Promise<void> {
  try {
    const tracking = await prisma.assetCompanyTracking.findUnique({
      where: { id: trackingId },
      select: { id: true, currentStageManualOverride: true },
    });
    if (!tracking || tracking.currentStageManualOverride) return;

    const allStatuses = await prisma.stageStatus.findMany({
      where: { trackingId },
      include: { stage: true },
      orderBy: { stage: { sequence: "asc" } },
    });

    let derivedStageKey: string | null = null;
    const inProgress = allStatuses.filter((s) => s.status === "IN_PROGRESS");
    if (inProgress.length > 0) {
      derivedStageKey = inProgress[inProgress.length - 1].stage.key;
    } else {
      const completed = allStatuses.filter((s) => s.status === "COMPLETED");
      if (completed.length > 0) {
        derivedStageKey = completed[completed.length - 1].stage.key;
      }
    }

    // Backfill: if the tracking has progressed to stage N (IN_PROGRESS or
    // COMPLETED), every earlier stage must be COMPLETED. The journey UI
    // can otherwise show a "?" or open badge on a teaser stage while the
    // investor is already past NDA — visually misleading. We auto-fill
    // these gaps with completedAt = now() so the timeline is coherent.
    let highestActiveIdx = -1;
    for (let i = 0; i < allStatuses.length; i++) {
      const s = allStatuses[i];
      if (s.status === "IN_PROGRESS" || s.status === "COMPLETED") {
        highestActiveIdx = i;
      }
    }
    if (highestActiveIdx > 0) {
      const stale = allStatuses
        .slice(0, highestActiveIdx)
        .filter((s) => s.status !== "COMPLETED");
      if (stale.length > 0) {
        // No StageHistory entry — this is an automatic system backfill,
        // not a user action. The triggering forward transition already
        // has its own history row, which is the auditable source of
        // truth. StageHistory.changedByUserId is non-nullable so we
        // can't attribute these without an arbitrary admin id.
        const now = new Date();
        await prisma.stageStatus.updateMany({
          where: { id: { in: stale.map((s) => s.id) } },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });
      }
    }

    await prisma.assetCompanyTracking.update({
      where: { id: trackingId },
      data: { currentStageKey: derivedStageKey },
    });
  } catch (e) {
    // Never let a sync failure leak — the stage transition that triggered
    // this is already committed; the worst case is the dropdown shows
    // a stale value until the next event fires.
    console.error("[syncCurrentStageKeyAfterCommit] failed:", e);
  }
}
