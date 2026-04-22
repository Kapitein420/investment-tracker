"use client";

import { useMemo } from "react";
import { type PipelineStage } from "@prisma/client";
import { cn } from "@/lib/utils";
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS } from "@/lib/stages";
import { Badge } from "@/components/ui/badge";

interface PipelineOverviewProps {
  trackings: Array<any>;
  stages: PipelineStage[];
}

// Color palette for the funnel bands
const BAND_COLORS = [
  { bg: "bg-status-success", text: "text-status-success", light: "bg-logistics-soft" },
  { bg: "bg-status-info", text: "text-banner-info-foreground", light: "bg-office-soft" },
  { bg: "bg-violet-500", text: "text-violet-700", light: "bg-violet-50" },
  { bg: "bg-status-warning", text: "text-status-warning", light: "bg-retail-soft" },
  { bg: "bg-rose-500", text: "text-rose-700", light: "bg-rose-50" },
];

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
        color: BAND_COLORS[idx % BAND_COLORS.length],
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
        color: BAND_COLORS[idx % BAND_COLORS.length],
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
      <div>
        <h3 className="text-sm font-semibold mb-4">Pipeline Funnel</h3>
        <p className="text-xs text-muted-foreground mb-4">Companies that have reached or passed each stage</p>
        <div className="space-y-2">
          {buckets.map((bucket, idx) => {
            const widthPct = Math.max((bucket.count / maxCount) * 100, 8);
            return (
              <div key={bucket.stage.id} className="flex items-center gap-3">
                <span className="w-16 text-xs font-medium text-right text-muted-foreground">
                  {bucket.stage.label}
                </span>
                <div className="flex-1 h-10 relative">
                  <div
                    className={cn(
                      "h-full rounded-md flex items-center px-3 transition-all duration-500",
                      bucket.color.bg
                    )}
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="text-sm font-bold text-primary-foreground">
                      {bucket.count}
                    </span>
                  </div>
                </div>
                <span className="w-10 text-xs text-muted-foreground text-right">
                  {activeTrackings.length > 0
                    ? `${Math.round((bucket.count / activeTrackings.length) * 100)}%`
                    : "0%"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current stage distribution */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Current Stage Distribution</h3>
        <p className="text-xs text-muted-foreground mb-4">Where each company currently sits in the pipeline</p>
        <div className="grid grid-cols-5 gap-3">
          {currentStageBuckets.map((bucket) => (
            <div
              key={bucket.stage.id}
              className={cn("rounded-lg border p-4 text-center", bucket.color.light)}
            >
              <p className="text-2xl font-bold">{bucket.count}</p>
              <p className="text-xs font-medium text-muted-foreground mt-1">{bucket.stage.label}</p>
              {bucket.companies.length > 0 && (
                <div className="mt-3 space-y-1">
                  {bucket.companies.map((c: any) => (
                    <p key={c.id} className="text-[11px] text-muted-foreground truncate">
                      {c.company.name}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lifecycle summary */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Lifecycle Status</h3>
        <div className="flex gap-3">
          {Object.entries(lifecycleCounts).map(([status, count]) => (
            <div key={status} className="flex-1 rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <Badge
                className={cn(
                  "mt-1 text-[10px] border-0",
                  LIFECYCLE_COLORS[status as keyof typeof LIFECYCLE_COLORS]
                )}
              >
                {LIFECYCLE_LABELS[status as keyof typeof LIFECYCLE_LABELS]}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion rates */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Stage Conversion</h3>
        <div className="flex items-center gap-2">
          {buckets.map((bucket, idx) => {
            const nextBucket = buckets[idx + 1];
            const conversionRate = nextBucket && bucket.count > 0
              ? Math.round((nextBucket.count / bucket.count) * 100)
              : null;

            return (
              <div key={bucket.stage.id} className="flex items-center gap-2">
                <div className="text-center">
                  <div className={cn("rounded-lg px-4 py-2", bucket.color.light)}>
                    <p className="text-lg font-bold">{bucket.count}</p>
                    <p className="text-[10px] font-medium text-muted-foreground">{bucket.stage.label}</p>
                  </div>
                </div>
                {conversionRate !== null && (
                  <div className="flex flex-col items-center px-1">
                    <span className="text-[10px] font-medium text-muted-foreground">{conversionRate}%</span>
                    <div className="h-px w-6 bg-border" />
                    <span className="text-[8px] text-muted-foreground">→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
