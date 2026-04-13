"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building, MapPin, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { canEdit } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { CreateAssetDialog } from "@/components/dashboard/create-asset-dialog";

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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">Track deal pipelines across your portfolio</p>
        </div>
        {canEdit(userRole) && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Asset
          </Button>
        )}
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Building className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">No assets found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((asset) => (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className="flex items-center justify-between rounded-lg border bg-white p-4 transition-colors hover:border-gold-300 hover:bg-gold-50/30"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold-100">
                  <Building className="h-5 w-5 text-gold-600" />
                </div>
                <div>
                  <h3 className="font-medium">{asset.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {asset.city}, {asset.country}
                    </span>
                    {asset.assetType && <Badge variant="secondary" className="text-xs">{asset.assetType}</Badge>}
                    {asset.brokerLabel && <span>Broker: {asset.brokerLabel}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="text-right">
                  <p className="font-medium text-foreground">{asset._count.trackings}</p>
                  <p className="text-xs">companies</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className="text-xs">{formatDate(asset.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateAssetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
