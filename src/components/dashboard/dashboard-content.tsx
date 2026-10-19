"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin, Calendar, Building2, EyeOff } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { canEdit } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { CreateAssetDialog } from "@/components/dashboard/create-asset-dialog";
import { AssetVisibilityMenu } from "@/components/asset/asset-visibility-menu";
import { assetTypeToUnit } from "@/lib/stages";

type AssetItem = {
  id: string;
  title: string;
  address: string;
  city: string;
  country: string;
  assetType: string | null;
  transactionType: string | null;
  brokerLabel: string | null;
  isHidden: boolean;
  hiddenFromInvestors: boolean;
  updatedAt: Date;
  createdBy: { name: string };
  _count: { trackings: number };
  coverImageUrl?: string | null;
};

export function DashboardContent({
  assets,
  userRole,
}: {
  assets: AssetItem[];
  userRole: Role;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const hiddenCount = assets.filter((a) => a.isHidden).length;
  const listed = showHidden ? assets : assets.filter((a) => !a.isHidden);

  const filtered = listed.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.city.toLowerCase().includes(search.toLowerCase()) ||
      a.address.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    const totalAssets = listed.length;
    const totalPipeline = listed.reduce((sum, a) => sum + a._count.trackings, 0);
    const activeAssets = listed.filter((a) => a._count.trackings > 0).length;

    const byUnit = new Map<string, number>();
    for (const a of listed) {
      const unit = assetTypeToUnit(a.assetType);
      byUnit.set(unit.label, (byUnit.get(unit.label) ?? 0) + 1);
    }
    const topUnits = Array.from(byUnit.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalAssets, totalPipeline, activeAssets, topUnits };
  }, [listed]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">
      {/* Editorial hero */}
      <div className="mb-10 flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-banner-info-foreground">
            Investment Sales · Pipeline
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-dils-black sm:text-4xl">
            Assets
          </h1>
          <p className="mt-3 max-w-prose text-sm text-muted-foreground">
            Track deal pipelines across the portfolio — companies, stages, and
            signed documents in one place.
          </p>
        </div>
        {canEdit(userRole) && (
          <Button onClick={() => setDialogOpen(true)} size="lg" className="w-full shrink-0 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
            New Asset
          </Button>
        )}
      </div>

      {/* KPI strip — editorial big-number tiles */}
      <div className="mb-10 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-dils-200 bg-dils-200 shadow-soft-card sm:grid-cols-3">
        <KpiTile
          label="Assets"
          value={stats.totalAssets}
          accent="bg-banner-info-foreground"
        />
        <KpiTile
          label="Investors in pipeline"
          value={stats.totalPipeline}
          accent="bg-soft-accent"
        />
        <KpiTile
          label="Active deals"
          value={stats.activeAssets}
          accent="bg-status-warning"
        />
      </div>

      {/* Unit breakdown strip */}
      {stats.topUnits.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-dils-200 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            By sector
          </p>
          {stats.topUnits.map(([label, count]) => {
            const unit = assetTypeToUnit(label);
            return (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className={`inline-block h-2 w-2 rounded-full ${unit.bar}`} />
                <span className="text-dils-black font-medium">{label}</span>
                <span className="text-muted-foreground tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
        <Input
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
        {canEdit(userRole) && hiddenCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowHidden((v) => !v)}>
            <EyeOff className="mr-2 h-4 w-4" strokeWidth={2} />
            {showHidden ? "Hide" : "Show"} hidden ({hiddenCount})
          </Button>
        )}
      </div>

      {/* Asset list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-dils-200 py-20 px-6 text-center">
          <p className="font-heading text-xl text-dils-black">
            {userRole === "VIEWER" && assets.length === 0 ? "No access yet" : "No assets yet"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {search
              ? "No matches — try a different search."
              : userRole === "VIEWER" && assets.length === 0
                ? "You haven't been granted access to any assets yet. Ask the deal team to add you to an asset."
                : hiddenCount > 0
                  ? "All assets are hidden — use Show hidden to bring them back."
                  : "Create your first asset to start tracking."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((asset) => {
            const unit = assetTypeToUnit(asset.assetType);
            return (
              <div key={asset.id} className="relative">
              <Link
                href={`/assets/${asset.id}`}
                className={cn(
                  "group flex items-stretch overflow-hidden rounded-md border border-dils-200 bg-white shadow-soft-card transition-all duration-150 hover:-translate-y-px hover:border-soft-office/40 hover:shadow-soft-card-hover",
                  asset.isHidden && "opacity-60"
                )}
              >
                {/* Business-unit colored edge */}
                <div className={`w-1.5 shrink-0 ${unit.bar}`} aria-hidden />

                <div className="flex flex-1 flex-col gap-4 p-3 pl-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="flex items-center gap-4 min-w-0">
                    {asset.coverImageUrl ? (
                      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md border border-dils-100 bg-soft-bg-surface-alt sm:h-[68px] sm:w-[88px]">
                        {/* Plain <img>: lets us serve a Supabase signed URL with no
                            extra remote-pattern config. Loading=lazy so the
                            list paints fast and below-the-fold rows defer. */}
                        <img
                          src={asset.coverImageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dils-100 sm:h-[68px] sm:w-[88px]",
                          unit.tint
                        )}
                        aria-hidden
                      >
                        <Building2 className="h-7 w-7 text-dils-black/40" strokeWidth={1.6} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-heading text-lg font-semibold tracking-tight text-dils-black truncate">
                        {asset.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" strokeWidth={2} />
                          {asset.city}, {asset.country}
                        </span>
                        <Badge variant="outline" className="border-dils-300 text-[10px] uppercase tracking-wider text-dils-700">
                          {unit.label}
                        </Badge>
                        {asset.brokerLabel && (
                          <span className="text-xs">Broker: {asset.brokerLabel}</span>
                        )}
                        {asset.isHidden && (
                          <Badge variant="outline" className="border-dils-300 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Hidden
                          </Badge>
                        )}
                        {asset.hiddenFromInvestors && (
                          <Badge variant="outline" className="border-dils-300 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Hidden from investors
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-6 pl-16 sm:pl-0", canEdit(userRole) && "sm:pr-10")}>
                    <div className="text-left sm:text-right">
                      <p className="font-heading text-3xl font-bold leading-none text-dils-black tabular-nums">
                        {asset._count.trackings}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        companies
                      </p>
                    </div>
                    <div className="text-left text-sm text-muted-foreground sm:text-right">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" strokeWidth={2} />
                        <span className="text-xs">{formatDate(asset.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              {canEdit(userRole) && (
                <div className="absolute right-2 top-2">
                  <AssetVisibilityMenu
                    assetId={asset.id}
                    isHidden={asset.isHidden}
                    hiddenFromInvestors={asset.hiddenFromInvestors}
                  />
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}

      <CreateAssetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="relative bg-white p-6">
      <span className={`absolute left-0 top-0 h-full w-1 ${accent}`} aria-hidden />
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-heading text-4xl font-bold leading-none text-dils-black tabular-nums sm:text-5xl">
        {value}
      </p>
    </div>
  );
}
