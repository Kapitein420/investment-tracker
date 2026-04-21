"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { canEdit } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { CreateAssetDialog } from "@/components/dashboard/create-asset-dialog";
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
  updatedAt: Date;
  createdBy: { name: string };
  _count: { trackings: number };
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

  const filtered = assets.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.city.toLowerCase().includes(search.toLowerCase()) ||
      a.address.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    const totalAssets = assets.length;
    const totalPipeline = assets.reduce((sum, a) => sum + a._count.trackings, 0);
    const activeAssets = assets.filter((a) => a._count.trackings > 0).length;

    const byUnit = new Map<string, number>();
    for (const a of assets) {
      const unit = assetTypeToUnit(a.assetType);
      byUnit.set(unit.label, (byUnit.get(unit.label) ?? 0) + 1);
    }
    const topUnits = Array.from(byUnit.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalAssets, totalPipeline, activeAssets, topUnits };
  }, [assets]);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-10">
      {/* Editorial hero */}
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dils-brass">
            Investment Sales · Pipeline
          </p>
          <h1 className="dils-accent mt-3 inline-block font-heading text-4xl font-bold tracking-tight text-dils-black">
            Assets
          </h1>
          <p className="mt-3 max-w-prose text-sm text-muted-foreground">
            Track deal pipelines across the portfolio — companies, stages, and
            signed documents in one place.
          </p>
        </div>
        {canEdit(userRole) && (
          <Button onClick={() => setDialogOpen(true)} size="lg" className="shrink-0">
            <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
            New Asset
          </Button>
        )}
      </div>

      {/* KPI strip — editorial big-number tiles */}
      <div className="mb-10 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-dils-200 bg-dils-200 sm:grid-cols-3">
        <KpiTile
          label="Assets"
          value={stats.totalAssets}
          accent="bg-dils-black"
        />
        <KpiTile
          label="Companies in pipeline"
          value={stats.totalPipeline}
          accent="bg-dils-red"
        />
        <KpiTile
          label="Active deals"
          value={stats.activeAssets}
          accent="bg-dils-brass"
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
      <div className="mb-6 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
        <Input
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Asset list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-dils-200 py-20">
          <p className="font-heading text-xl text-dils-black">No assets yet</p>
          <div className="mt-2 h-px w-12 bg-dils-brass" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? "No matches — try a different search." : "Create your first asset to start tracking."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((asset) => {
            const unit = assetTypeToUnit(asset.assetType);
            return (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="group flex items-stretch overflow-hidden rounded-md border border-dils-200 bg-white transition-colors hover:border-dils-black hover:bg-dils-50/40"
              >
                {/* Business-unit colored edge */}
                <div className={`w-1.5 shrink-0 ${unit.bar}`} aria-hidden />

                <div className="flex flex-1 items-center justify-between gap-6 p-4 pl-5">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${unit.tint} font-heading text-lg font-bold text-dils-black`}>
                      {asset.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-dils-black truncate">
                        {asset.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
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
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-heading text-3xl font-bold leading-none text-dils-black tabular-nums">
                        {asset._count.trackings}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        companies
                      </p>
                    </div>
                    <div className="hidden text-right text-sm text-muted-foreground sm:block">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" strokeWidth={2} />
                        <span className="text-xs">{formatDate(asset.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
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
      <p className="mt-3 font-heading text-5xl font-bold leading-none text-dils-black tabular-nums">
        {value}
      </p>
    </div>
  );
}
