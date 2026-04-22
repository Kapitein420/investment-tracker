import { StageStatusValue, PipelineStage } from "@prisma/client";

export const STAGE_STATUS_LABELS: Record<StageStatusValue, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  DECLINED: "Declined",
};

export const STAGE_STATUS_COLORS: Record<StageStatusValue, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-office-soft text-office",
  COMPLETED: "bg-logistics-soft text-logistics",
  BLOCKED: "bg-retail-soft text-retail",
  DECLINED: "bg-destructive/10 text-destructive",
};

export const STAGE_DOT_COLORS: Record<StageStatusValue, string> = {
  NOT_STARTED: "bg-border",
  IN_PROGRESS: "bg-status-info",
  COMPLETED: "bg-status-success",
  BLOCKED: "bg-status-warning",
  DECLINED: "bg-status-danger",
};

export const LIFECYCLE_LABELS = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
  ON_HOLD: "On Hold",
} as const;

export const LIFECYCLE_COLORS = {
  ACTIVE: "bg-logistics-soft text-logistics",
  COMPLETED: "bg-office-soft text-office",
  DROPPED: "bg-destructive/10 text-destructive",
  ON_HOLD: "bg-retail-soft text-retail",
} as const;

export const INTEREST_LABELS = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
  NONE: "None",
} as const;

export const INTEREST_COLORS = {
  HOT: "bg-destructive/10 text-destructive",
  WARM: "bg-retail-soft text-retail",
  COLD: "bg-office-soft text-office",
  NONE: "bg-muted text-muted-foreground",
} as const;

/** Map a free-form assetType string to a business-category color class.
 *  Uses next-portal-enterprise-soft tokens (office/retail/logistics/living). */
export function assetTypeToUnit(assetType: string | null | undefined): {
  key: "office" | "logistics" | "hospitality" | "living" | "retail" | "default";
  bar: string;
  tint: string;
  label: string;
} {
  const t = (assetType ?? "").toLowerCase();
  if (t.includes("office"))       return { key: "office",       bar: "bg-office",       tint: "bg-office-soft",       label: "Office" };
  if (t.includes("logistic"))     return { key: "logistics",    bar: "bg-logistics",    tint: "bg-logistics-soft",    label: "Logistics" };
  if (t.includes("hospit") || t.includes("hotel"))
                                  return { key: "hospitality",  bar: "bg-hospitality",  tint: "bg-muted",             label: "Hospitality" };
  if (t.includes("living") || t.includes("residential") || t.includes("resi"))
                                  return { key: "living",       bar: "bg-living",       tint: "bg-living-soft",       label: "Living" };
  if (t.includes("retail"))       return { key: "retail",       bar: "bg-retail",       tint: "bg-retail-soft",       label: "Retail" };
  return { key: "default", bar: "bg-border", tint: "bg-muted", label: assetType ?? "Other" };
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
