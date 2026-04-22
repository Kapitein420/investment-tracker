import { StageStatusValue, PipelineStage } from "@prisma/client";

export const STAGE_STATUS_LABELS: Record<StageStatusValue, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  DECLINED: "Declined",
};

export const STAGE_STATUS_COLORS: Record<StageStatusValue, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-500",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  BLOCKED: "bg-amber-100 text-amber-700",
  DECLINED: "bg-red-100 text-red-700",
};

export const STAGE_DOT_COLORS: Record<StageStatusValue, string> = {
  NOT_STARTED: "bg-gray-300",
  IN_PROGRESS: "bg-blue-500",
  COMPLETED: "bg-emerald-500",
  BLOCKED: "bg-amber-500",
  DECLINED: "bg-red-500",
};

export const LIFECYCLE_LABELS = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
  ON_HOLD: "On Hold",
} as const;

export const LIFECYCLE_COLORS = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  DROPPED: "bg-red-100 text-red-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
} as const;

export const INTEREST_LABELS = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
  NONE: "None",
} as const;

export const INTEREST_COLORS = {
  HOT: "bg-red-100 text-red-700",
  WARM: "bg-orange-100 text-orange-700",
  COLD: "bg-sky-100 text-sky-700",
  NONE: "bg-gray-100 text-gray-500",
} as const;

/** Map a free-form assetType string to a Dils business-unit color class.
 *  Unit palette from the Brand Identity Guidelines 2025-05-14. */
export function assetTypeToUnit(assetType: string | null | undefined): {
  key: "office" | "logistics" | "hospitality" | "living" | "retail" | "default";
  bar: string;
  tint: string;
  label: string;
} {
  const t = (assetType ?? "").toLowerCase();
  if (t.includes("office"))       return { key: "office",       bar: "bg-unit-office",       tint: "bg-unit-office/15",      label: "Office" };
  if (t.includes("logistic"))     return { key: "logistics",    bar: "bg-unit-logistics",    tint: "bg-unit-logistics/20",   label: "Logistics" };
  if (t.includes("hospit") || t.includes("hotel"))
                                  return { key: "hospitality",  bar: "bg-unit-hospitality",  tint: "bg-unit-hospitality/15", label: "Hospitality" };
  if (t.includes("living") || t.includes("residential") || t.includes("resi"))
                                  return { key: "living",       bar: "bg-unit-living",       tint: "bg-unit-living/25",      label: "Living" };
  if (t.includes("retail"))       return { key: "retail",       bar: "bg-unit-retail",       tint: "bg-unit-retail/15",      label: "Retail" };
  return { key: "default", bar: "bg-dils-200", tint: "bg-dils-50", label: assetType ?? "Other" };
}

/** Derive the current stage from stage statuses (furthest completed or in-progress). */
export function deriveCurrentStage(
  stageStatuses: Array<{ stage: Pick<PipelineStage, "key" | "sequence">; status: StageStatusValue }>,
  manualOverride: boolean,
  manualStageKey: string | null
): string | null {
  if (manualOverride && manualStageKey) return manualStageKey;

  const sorted = [...stageStatuses].sort((a, b) => b.stage.sequence - a.stage.sequence);

  for (const ss of sorted) {
    if (ss.status === "COMPLETED" || ss.status === "IN_PROGRESS") {
      return ss.stage.key;
    }
  }

  return null;
}

/** Get the next stage in sequence. */
export function getNextStageKey(
  stages: Array<Pick<PipelineStage, "key" | "sequence">>,
  currentKey: string | null
): string | null {
  if (!currentKey) return stages[0]?.key ?? null;

  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence);
  const idx = sorted.findIndex((s) => s.key === currentKey);
  if (idx === -1 || idx >= sorted.length - 1) return null;
  return sorted[idx + 1].key;
}

/** Compute summary counts for each stage. */
export function computeStageSummaryCounts(
  trackings: Array<{
    stageStatuses: Array<{ stage: { key: string }; status: StageStatusValue }>;
    lifecycleStatus: string;
  }>
) {
  const counts: Record<string, { completed: number; inProgress: number; total: number }> = {};

  for (const t of trackings) {
    if (t.lifecycleStatus === "DROPPED") continue;
    for (const ss of t.stageStatuses) {
      if (!counts[ss.stage.key]) {
        counts[ss.stage.key] = { completed: 0, inProgress: 0, total: 0 };
      }
      counts[ss.stage.key].total++;
      if (ss.status === "COMPLETED") counts[ss.stage.key].completed++;
      if (ss.status === "IN_PROGRESS") counts[ss.stage.key].inProgress++;
    }
  }

  return counts;
}
