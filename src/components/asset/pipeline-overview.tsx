"use client";

import { useMemo, useState } from "react";
import { type PipelineStage } from "@prisma/client";
import { Star } from "lucide-react";
import { cn, formatBid } from "@/lib/utils";
import { LIFECYCLE_LABELS } from "@/lib/stages";

// Max companies shown per funnel bucket before collapsing the rest behind
// a "+ N more" toggle. Keeps the funnel from growing taller than its
// neighbour buckets when one stage gets crowded.
const BUCKET_MAX_VISIBLE = 4;

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

  // Tracks which buckets are showing all their companies (vs capped to
  // BUCKET_MAX_VISIBLE). Keyed by stage.id so re-renders don't blow it up.
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  function toggleBucket(stageId: string) {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

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

  // Lifecycle breakdown
  const lifecycleCounts = useMemo(() => {
    const counts: Record<string, number> = { ACTIVE: 0, COMPLETED: 0, DROPPED: 0, ON_HOLD: 0 };
    for (const t of trackings) {
      counts[t.lifecycleStatus] = (counts[t.lifecycleStatus] || 0) + 1;
    }
    return counts;
  }, [trackings]);

  // Sorted bids — full descending list driving both the leaderboard card
  // and the "highest bidder" star in the funnel. DROPPED trackings are
  // excluded so a stale offer from a passed-on investor doesn't sit at
  // the top of the leaderboard.
  const sortedBids = useMemo(() => {
    const rows: Array<{
      trackingId: string;
      companyName: string;
      amount: number;
      currency: string;
    }> = [];
    for (const t of activeTrackings) {
      if (t.bidAmount == null || t.bidAmount === "") continue;
      const n = Number(t.bidAmount);
      if (!Number.isFinite(n)) continue;
      rows.push({
        trackingId: t.id,
        companyName: t.company?.name ?? "Unknown",
        amount: n,
        currency: t.bidCurrency ?? "EUR",
      });
    }
    rows.sort((a, b) => b.amount - a.amount);
    return rows;
  }, [activeTrackings]);

  // Bid stats — derived from the same sorted list so the headline numbers
  // and the leaderboard never disagree. Modal currency is used for the
  // headline ("Highest bid" tile) because mixing currencies in one
  // number would be misleading.
  const bidStats = useMemo(() => {
    if (sortedBids.length === 0) {
      return { count: 0, highest: null, currency: "EUR", topBidderTrackingId: null };
    }
    const currencyCounts: Record<string, number> = {};
    for (const r of sortedBids) {
      currencyCounts[r.currency] = (currencyCounts[r.currency] ?? 0) + 1;
    }
    const currency =
      Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "EUR";
    return {
      count: sortedBids.length,
      highest: sortedBids[0].amount,
      currency,
      topBidderTrackingId: sortedBids[0].trackingId,
    };
  }, [sortedBids]);

  return (
    <div className="space-y-8">
      {/* Combined Pipeline Stages — replaces the prior "Pipeline Funnel"
          + "Current Stage Distribution" + "Stage Conversion" trio. The
          funnel chart was confusing (showed cumulative-pass percentages
          like "60%" with no obvious denominator). This single view shows
          where each company currently sits, lists their names inline, and
          weaves the stage-to-stage conversion arrows between cards. */}
      <section>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">Pipeline Stages</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Where each company currently sits, with conversion to the next stage
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {currentStageBuckets.map((bucket, idx) => {
            const isEmpty = bucket.count === 0;
            // Cumulative-pass bucket for the conversion math — companies
            // that have reached this stage or passed it. Conversion to
            // the next stage = nextReached / thisReached.
            const reachedThis = buckets[idx]?.count ?? 0;
            const reachedNext = buckets[idx + 1]?.count ?? null;
            const conversion =
              reachedNext !== null && reachedThis > 0
                ? Math.round((reachedNext / reachedThis) * 100)
                : null;
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
                {conversion !== null && (
                  <p className="mt-1 text-[10px] font-medium text-foreground/60">
                    {conversion}% → next
                  </p>
                )}
                <div className="mt-3 border-t border-dashed border-dils-200 pt-3 min-h-[22px] text-left">
                  {isEmpty ? (
                    <p className="text-center text-[12px] italic text-muted-foreground">—</p>
                  ) : (
                    (() => {
                      const isExpanded = expandedBuckets.has(bucket.stage.id);
                      const overflowCount = Math.max(
                        0,
                        bucket.companies.length - BUCKET_MAX_VISIBLE
                      );
                      const visibleCompanies = isExpanded
                        ? bucket.companies
                        : bucket.companies.slice(0, BUCKET_MAX_VISIBLE);
                      return (
                        <>
                          <div className="space-y-0.5">
                            {visibleCompanies.map((c: any) => {
                              const hasBid =
                                c.bidAmount != null && String(c.bidAmount).trim() !== "";
                              const isLeader =
                                hasBid && c.id === bidStats.topBidderTrackingId;
                              return (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between gap-1.5 text-[12px] text-muted-foreground"
                                  title={c.company.name}
                                >
                                  <span className="flex min-w-0 items-center gap-1">
                                    {isLeader && (
                                      <Star
                                        className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500"
                                        strokeWidth={1.5}
                                      />
                                    )}
                                    <span className="truncate">{c.company.name}</span>
                                  </span>
                                  {hasBid && (
                                    <span
                                      className={cn(
                                        "shrink-0 font-semibold tabular-nums",
                                        isLeader ? "text-amber-600" : "text-foreground/80"
                                      )}
                                    >
                                      {formatBid(c.bidAmount, c.bidCurrency ?? "EUR", { compact: true })}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {overflowCount > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleBucket(bucket.stage.id)}
                              className="mt-1.5 block w-full border-t border-dashed border-dils-100 pt-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {isExpanded ? "Show less" : `+ ${overflowCount} more`}
                            </button>
                          )}
                        </>
                      );
                    })()
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

      {/* Bids — only rendered once at least one offer has been recorded.
          Sits below the funnel + lifecycle so it doesn't lead the page
          on pre-NBO assets. The third card is a Top Offers leaderboard
          rather than an "average bid" tile — when there are 1–2 bids
          the average is uninformative; the ranking is always useful. */}
      {bidStats.count > 0 && (
        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">Bids</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Offers recorded on active companies
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {/* Offers received */}
            <div className="rounded-lg border border-dils-200 bg-white p-5 text-center shadow-soft-card">
              <p className="font-heading text-3xl font-semibold leading-none text-foreground tabular-nums">
                {bidStats.count}
              </p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
                Offers received
              </p>
            </div>
            {/* Highest bid */}
            <div className="rounded-lg border border-dils-200 bg-white p-5 text-center shadow-soft-card">
              <p
                className="font-heading text-3xl font-semibold leading-none text-foreground tabular-nums"
                title={
                  bidStats.highest != null
                    ? formatBid(bidStats.highest, bidStats.currency)
                    : undefined
                }
              >
                {bidStats.highest != null
                  ? formatBid(bidStats.highest, bidStats.currency, { compact: true })
                  : "—"}
              </p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
                Highest bid
              </p>
            </div>
            {/* Top offers leaderboard — spans 2 columns on md+ so it's
                wider than the headline-number cards. */}
            <div className="rounded-lg border border-dils-200 bg-white p-4 shadow-soft-card md:col-span-2">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
                  Top offers
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {bidStats.count} active
                </span>
              </div>
              <ul className="divide-y divide-dils-100">
                {sortedBids.map((row, idx) => {
                  const rankClass =
                    idx === 0
                      ? "bg-amber-500 text-white"
                      : idx === 1
                        ? "bg-gray-400 text-white"
                        : idx === 2
                          ? "bg-amber-800 text-white"
                          : "bg-soft-bg-surface-alt text-muted-foreground";
                  return (
                    <li
                      key={row.trackingId}
                      className="flex items-center gap-2.5 py-1.5 text-sm"
                    >
                      <span
                        className={cn(
                          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          rankClass
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate text-foreground/90"
                        title={row.companyName}
                      >
                        {row.companyName}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-semibold tabular-nums",
                          idx === 0 ? "text-amber-600" : "text-foreground"
                        )}
                        title={formatBid(row.amount, row.currency)}
                      >
                        {formatBid(row.amount, row.currency, { compact: true })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
