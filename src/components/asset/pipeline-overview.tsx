"use client";

import { useMemo } from "react";
import { type PipelineStage } from "@prisma/client";
import { cn } from "@/lib/utils";
import { LIFECYCLE_LABELS } from "@/lib/stages";

interface PipelineOverviewProps {
  trackings: Array<any>;
  stages: PipelineStage[];
}

// Soft-enterprise funnel sequence — replaces the prior vivid green/blue/violet/amber/rose.
// Order matches the mockup's `--funnel-1..5` tokens: success → office → research → warning → danger.
const FUNNEL_BANDS = [
  { bar: "bg-funnel-1", edge: "bg-funnel-1" },
  { bar: "bg-funnel-2", edge: "bg-funnel-2" },
  { bar: "bg-funnel-3", edge: "bg-funnel-3" },
  { bar: "bg-funnel-4", edge: "bg-funnel-4" },
  { bar: "bg-funnel-5", edge: "bg-funnel-5" },
];

const LIFECYCLE_CHIP: Record<string, string> = {
  ACTIVE: "bg-status-success-soft text-status-success",
  COMPLETED: "bg-soft-office-soft text-soft-office",
  DROPPED: "bg-status-danger-soft text-status-danger",
  ON_HOLD: "bg-status-warning-soft text-status-warning",
};

export function PipelineOverview({ trackings, stages }: PipelineOverviewProps) {
  const activeTrackings = trackings.filter((t) => t.lifecycleStatus !== "DROPPED");

  // Compute which companies are in each stage bucket
  const buckets = useMemo(() => {
    return stages.map((stage, idx) => {
      const companies = activeTrackings.filter((t) => {
        const ss = t.stageStatuses.find((s: any) => s.stage.key === stage.key);
        return ss && (ss.status === "COMPLETED" || ss.status === "IN_PROGRESS");
      });
      return {
        stage,
        companies,
        count: companies.length,
        band: FUNNEL_BANDS[idx % FUNNEL_BANDS.length],
      };
    });
  }, [activeTrackings, stages]);

  // Companies by current stage (where they currently are)
  const currentStageBuckets = useMemo(() => {
    return stages.map((stage, idx) => {
      const companies = activeTrackings.filter((t) => t.currentStageKey === stage.key);
      return {
        stage,
        companies,
        count: companies.length,
        band: FUNNEL_BANDS[idx % FUNNEL_BANDS.length],
      };
    });
  }, [activeTrackings, stages]);

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  // Lifecycle breakdown
  const lifecycleCounts = useMemo(() => {
    const counts: Record<string, number> = { ACTIVE: 0, COMPLETED: 0, DROPPED: 0, ON_HOLD: 0 };
    for (const t of trackings) {
      counts[t.lifecycleStatus] = (counts[t.lifecycleStatus] || 0) + 1;
    }
    return counts;
  }, [trackings]);

  return (
    <div className="space-y-8">
      {/* Funnel visualization */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">Pipeline Funnel</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Companies that have reached or passed each stage
        </p>
        <div className="rounded-lg border border-dils-200 bg-white p-5 shadow-soft-card sm:p-6">
          <div className="space-y-1.5">
            {buckets.map((bucket) => {
              const widthPct = Math.max((bucket.count / maxCount) * 100, 8);
              const pct =
                activeTrackings.length > 0
                  ? `${Math.round((bucket.count / activeTrackings.length) * 100)}%`
                  : "0%";
              return (
                <div
                  key={bucket.stage.id}
                  className="grid items-center gap-3"
                  style={{ gridTemplateColumns: "80px 1fr 56px" }}
                >
                  <span className="text-right text-[13px] font-semibold text-muted-foreground">
                    {bucket.stage.label}
                  </span>
                  <div className="h-8 overflow-hidden rounded-md bg-soft-bg-surface-alt">
                    <div
                      className={cn("h-full flex items-center px-3 rounded-md transition-all duration-500", bucket.band.bar)}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="text-[13px] font-semibold text-white">
                        {bucket.count}
                      </span>
                    </div>
                  </div>
                  <span className="text-right text-xs font-semibold text-muted-foreground">
                    {pct}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Current stage distribution */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">Current Stage Distribution</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Where each company currently sits in the pipeline
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {currentStageBuckets.map((bucket) => {
            const isEmpty = bucket.count === 0;
            return (
              <div
                key={bucket.stage.id}
                className="relative overflow-hidden rounded-lg border border-dils-200 bg-white p-4 text-center shadow-soft-card"
              >
                <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", bucket.band.edge)} />
                <p className="font-heading text-3xl font-semibold leading-none text-foreground tabular-nums">
                  {bucket.count}
                </p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
                  {bucket.stage.label}
                </p>
                <div className="mt-3 border-t border-dashed border-dils-200 pt-3 min-h-[22px]">
                  {isEmpty ? (
                    <p className="text-[12px] italic text-muted-foreground">—</p>
                  ) : (
                    <div className="space-y-0.5">
                      {bucket.companies.map((c: any) => (
                        <p key={c.id} className="text-[12px] text-muted-foreground truncate">
                          {c.company.name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lifecycle summary */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">Lifecycle Status</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(lifecycleCounts).map(([status, count]) => (
            <div
              key={status}
              className="rounded-lg border border-dils-200 bg-white p-5 text-center shadow-soft-card"
            >
              <p className="font-heading text-3xl font-semibold leading-none text-foreground tabular-nums">{count}</p>
              <span className={cn(
                "mt-3 inline-block rounded-full px-3 py-1 text-[11px] font-semibold",
                LIFECYCLE_CHIP[status] ?? "bg-soft-bg-surface-alt text-muted-foreground"
              )}>
                {LIFECYCLE_LABELS[status as keyof typeof LIFECYCLE_LABELS]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Conversion rates */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">Stage Conversion</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dils-200 bg-white p-5 shadow-soft-card sm:p-6">
          {buckets.map((bucket, idx) => {
            const nextBucket = buckets[idx + 1];
            const conversionRate = nextBucket && bucket.count > 0
              ? Math.round((nextBucket.count / bucket.count) * 100)
              : null;

            return (
              <div key={bucket.stage.id} className="flex items-center gap-2">
                <div className="flex min-w-[80px] flex-col items-center gap-1 rounded-md border border-dils-200 bg-soft-bg-surface-alt px-4 py-3">
                  <p className="font-heading text-xl font-semibold leading-none text-foreground tabular-nums">{bucket.count}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">{bucket.stage.label}</p>
                </div>
                {conversionRate !== null && (
                  <div className="flex flex-col items-center gap-0.5 px-1 text-muted-foreground">
                    <span className="text-[11px] font-semibold text-foreground/70">{conversionRate}%</span>
                    <span className="text-base leading-none">→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
