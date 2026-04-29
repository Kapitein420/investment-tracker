"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Role, type PipelineStage, type Company } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Search, Download, Upload, Building, MapPin, Filter, BarChart3, Table2, FileStack,
} from "lucide-react";
import Link from "next/link";
import { canEdit } from "@/lib/permissions";
import { computeStageSummaryCounts, LIFECYCLE_LABELS, STAGE_DOT_COLORS } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { PipelineTable } from "@/components/asset/pipeline-table";
import { PipelineOverview } from "@/components/asset/pipeline-overview";
import { AddTrackingDialog } from "@/components/asset/add-tracking-dialog";
import { TrackingDetailDrawer } from "@/components/asset/tracking-detail-drawer";
import { ContentTab } from "@/components/asset/content-tab";
import { ImportDialog } from "@/components/asset/import-dialog";
import { BulkInviteDialog } from "@/components/asset/bulk-invite-dialog";
import { Users } from "lucide-react";

type AssetDetailProps = {
  asset: any;
  stages: PipelineStage[];
  users: Array<{ id: string; name: string }>;
  companies: Company[];
  contents: any[];
  currentUser: { id: string; name: string; email: string; role: Role };
};

export function AssetDetailView({ asset, stages, users, companies, contents, currentUser }: AssetDetailProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "overview" | "content">("overview");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);

  const editable = canEdit(currentUser.role);

  const stageSummary = useMemo(() => computeStageSummaryCounts(asset.trackings), [asset.trackings]);

  const filteredTrackings = useMemo(() => {
    return asset.trackings.filter((t: any) => {
      if (search && !t.company.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (lifecycleFilter !== "all" && t.lifecycleStatus !== lifecycleFilter) return false;
      if (typeFilter !== "all" && t.relationshipType !== typeFilter) return false;
      if (stageFilter !== "all") {
        const stageStatus = t.stageStatuses.find((ss: any) => ss.stage.key === stageFilter);
        if (!stageStatus || stageStatus.status === "NOT_STARTED") return false;
      }
      return true;
    });
  }, [asset.trackings, search, lifecycleFilter, typeFilter, stageFilter]);

  const activeCount = asset.trackings.filter((t: any) => t.lifecycleStatus === "ACTIVE").length;
  const droppedCount = asset.trackings.filter((t: any) => t.lifecycleStatus === "DROPPED").length;

  // Investors stuck behind admin approval — NDA stage is COMPLETED
  // (signed) but no approvedAt yet. IM stays locked silently otherwise.
  const pendingApprovals = asset.trackings.filter((t: any) =>
    t.stageStatuses?.some(
      (ss: any) => ss.stage?.key === "nda" && ss.status === "COMPLETED" && !ss.approvedAt
    )
  );

  const relationshipTypes = Array.from(new Set(asset.trackings.map((t: any) => t.relationshipType)));

  function handleExportCSV() {
    const headers = ["Company", "Type", "Lifecycle", "Current Stage", ...stages.map((s) => s.label), "Comment"];
    const rows = filteredTrackings.map((t: any) => [
      t.company.name,
      t.relationshipType,
      t.lifecycleStatus,
      t.currentStageKey ?? "",
      ...stages.map((s) => {
        const ss = t.stageStatuses.find((x: any) => x.stage.key === s.key);
        return ss?.status ?? "NOT_STARTED";
      }),
      t.latestCommentPreview ?? "",
    ]);

    const csvContent = [headers, ...rows].map((r) => r.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${asset.title.replace(/\s+/g, "_")}_pipeline.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-dils-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/" className="text-muted-foreground hover:text-dils-black">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </Link>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Assets</span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="dils-accent inline-block font-heading text-2xl font-bold tracking-tight text-dils-black sm:text-3xl">
              {asset.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                {asset.address}, {asset.city}
              </span>
              {asset.assetType && <Badge variant="secondary" className="text-xs">{asset.assetType}</Badge>}
              {asset.transactionType && <Badge variant="outline" className="text-xs border-dils-300 text-dils-700">{asset.transactionType}</Badge>}
              {asset.brokerLabel && <span>Broker: {asset.brokerLabel}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-md border bg-muted p-0.5">
              <button
                onClick={() => setView("table")}
                className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors", view === "table" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Table2 className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                onClick={() => setView("overview")}
                className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors", view === "overview" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Overview
              </button>
              <button
                onClick={() => setView("content")}
                className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors", view === "content" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <FileStack className="h-3.5 w-3.5" />
                Content
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            {editable && (
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Import
              </Button>
            )}
            {editable && (
              <Button variant="outline" size="sm" onClick={() => setBulkInviteOpen(true)}>
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Bulk invite
              </Button>
            )}
            {editable && (
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Company
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* NDAs awaiting approval banner. Shows up only when at least one
          investor has signed but not been approved — that investor's IM
          stays locked silently until an admin acts. */}
      {editable && pendingApprovals.length > 0 && (
        <div className="border-b bg-amber-50 px-4 py-2.5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-900">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
              <span>
                <strong>{pendingApprovals.length}</strong>{" "}
                {pendingApprovals.length === 1 ? "investor has" : "investors have"} signed the NDA and {pendingApprovals.length === 1 ? "is" : "are"} awaiting approval —{" "}
                {pendingApprovals
                  .slice(0, 3)
                  .map((t: any) => t.company.name)
                  .join(", ")}
                {pendingApprovals.length > 3 ? ` +${pendingApprovals.length - 3} more` : ""}
                .
              </span>
            </div>
            <button
              className="shrink-0 text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
              onClick={() => setSelectedTrackingId(pendingApprovals[0].id)}
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Stage summary strip */}
      <div className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="font-semibold text-foreground">{asset.trackings.length}</span>
            <span className="text-muted-foreground">Total</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-sm">
            <span className="font-semibold text-emerald-700">{activeCount}</span>
            <span className="text-emerald-600">Active</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm">
            <span className="font-semibold text-red-700">{droppedCount}</span>
            <span className="text-red-600">Dropped</span>
          </div>

          <div className="mx-2 h-6 w-px shrink-0 bg-border" />

          {stages.map((stage) => {
            const counts = stageSummary[stage.key] || { completed: 0, inProgress: 0, total: 0 };
            const isFiltered = stageFilter === stage.key;
            return (
              <button
                key={stage.key}
                onClick={() => setStageFilter(isFiltered ? "all" : stage.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isFiltered ? "bg-dils-black text-white" : "bg-dils-50 hover:bg-dils-100"
                )}
              >
                <span className="font-medium">{stage.label}</span>
                <span className="flex items-center gap-1">
                  <span className={cn("inline-block h-2 w-2 rounded-full", STAGE_DOT_COLORS.COMPLETED)} />
                  <span className="text-xs text-muted-foreground">{counts.completed}</span>
                </span>
                {counts.inProgress > 0 && (
                  <span className="flex items-center gap-1">
                    <span className={cn("inline-block h-2 w-2 rounded-full", STAGE_DOT_COLORS.IN_PROGRESS)} />
                    <span className="text-xs text-muted-foreground">{counts.inProgress}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {view === "table" ? (
        <>
          {/* Filters */}
          <div className="border-b bg-white px-4 py-2.5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="relative w-full sm:max-w-xs sm:flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-9 text-sm"
                />
              </div>
              <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
                <SelectTrigger className="h-8 w-[140px] text-sm">
                  <SelectValue placeholder="Lifecycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(LIFECYCLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[140px] text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {relationshipTypes.map((type) => (
                    <SelectItem key={type as string} value={type as string}>{type as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(search || lifecycleFilter !== "all" || typeFilter !== "all" || stageFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setSearch("");
                    setLifecycleFilter("all");
                    setTypeFilter("all");
                    setStageFilter("all");
                  }}
                >
                  <Filter className="mr-1 h-3 w-3" />
                  Clear filters
                </Button>
              )}
              <span className="text-xs text-muted-foreground sm:ml-auto">
                {filteredTrackings.length} of {asset.trackings.length} rows
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-4 py-3 sm:px-6">
            <PipelineTable
              trackings={filteredTrackings}
              stages={stages}
              users={users}
              editable={editable}
              currentUserId={currentUser.id}
              onRowClick={(id) => setSelectedTrackingId(id)}
            />
          </div>
        </>
      ) : view === "overview" ? (
        <div className="flex-1 overflow-auto px-4 py-6 sm:px-6">
          <PipelineOverview trackings={asset.trackings} stages={stages} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-4 py-6 sm:px-6">
          <ContentTab
            assetId={asset.id}
            contents={contents}
            trackings={asset.trackings}
            editable={editable}
            assetFieldDefaults={(asset.fieldDefaults ?? {}) as Record<string, string>}
          />
        </div>
      )}

      {/* Add tracking dialog */}
      <AddTrackingDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        assetId={asset.id}
        companies={companies}
        existingCompanyIds={asset.trackings.map((t: any) => t.companyId)}
      />

      {/* Bulk invite (CSV → up to 50 investors) */}
      <BulkInviteDialog
        open={bulkInviteOpen}
        onOpenChange={setBulkInviteOpen}
        assetId={asset.id}
      />

      {/* Detail drawer */}
      {selectedTrackingId && (
        <TrackingDetailDrawer
          trackingId={selectedTrackingId}
          stages={stages}
          users={users}
          editable={editable}
          currentUserId={currentUser.id}
          onClose={() => setSelectedTrackingId(null)}
        />
      )}

      {/* Import dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        assetId={asset.id}
      />
    </div>
  );
}
