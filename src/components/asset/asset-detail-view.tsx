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

  // Investors who have requested a property viewing — viewing stage is
  // IN_PROGRESS and the broker still needs to schedule a date with them.
  // Triggered by the "Request viewing" CTA on the investor portal.
  const pendingViewingRequests = asset.trackings.filter((t: any) =>
    t.stageStatuses?.some(
      (ss: any) => ss.stage?.key === "viewing" && ss.status === "IN_PROGRESS"
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
        <div className="flex items-center gap-1.5 mb-2">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-dils-black">
            <ArrowLeft className="h-3 w-3" strokeWidth={2.4} />
            Assets
          </Link>
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
              {asset.assetType && (
                <span className="inline-flex items-center rounded border border-soft-office/30 bg-soft-office-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em] text-soft-office">
                  {asset.assetType}
                </span>
              )}
              {asset.transactionType && (
                <span className="inline-flex items-center rounded border border-soft-retail/30 bg-soft-retail-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em] text-soft-retail">
                  {asset.transactionType}
                </span>
              )}
              {asset.brokerLabel && <span>Broker: <strong className="font-medium text-dils-black">{asset.brokerLabel}</strong></span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex overflow-hidden rounded-md border border-dils-200 bg-white">
              <button
                onClick={() => setView("table")}
                className={cn(
                  "inline-flex items-center gap-1.5 border-r border-dils-200 px-3.5 py-2 text-[13px] font-medium transition-colors",
                  view === "table"
                    ? "bg-soft-bg-surface-alt text-foreground font-semibold shadow-[inset_0_-2px_0_0_theme(colors.banner-info.foreground)]"
                    : "text-muted-foreground hover:bg-soft-bg-surface-alt hover:text-foreground"
                )}
              >
                <Table2 className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                onClick={() => setView("overview")}
                className={cn(
                  "inline-flex items-center gap-1.5 border-r border-dils-200 px-3.5 py-2 text-[13px] font-medium transition-colors",
                  view === "overview"
                    ? "bg-soft-bg-surface-alt text-foreground font-semibold shadow-[inset_0_-2px_0_0_theme(colors.banner-info.foreground)]"
                    : "text-muted-foreground hover:bg-soft-bg-surface-alt hover:text-foreground"
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Overview
              </button>
              <button
                onClick={() => setView("content")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium transition-colors",
                  view === "content"
                    ? "bg-soft-bg-surface-alt text-foreground font-semibold shadow-[inset_0_-2px_0_0_theme(colors.banner-info.foreground)]"
                    : "text-muted-foreground hover:bg-soft-bg-surface-alt hover:text-foreground"
                )}
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
        <div className="border-b border-l-[3px] border-l-status-warning bg-status-warning-soft px-4 py-2.5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-status-warning">
              <span className="inline-flex h-2 w-2 rounded-full bg-status-warning" />
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
              className="shrink-0 text-xs font-semibold text-status-warning underline-offset-2 hover:underline"
              onClick={() => setSelectedTrackingId(pendingApprovals[0].id)}
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Viewing requests banner. Shows when one or more investors have
          clicked "Request viewing" on their investor portal — the broker
          needs to follow up to schedule a date. The investor was emailed,
          but this surfaces it in the admin UI so it can't be missed. */}
      {editable && pendingViewingRequests.length > 0 && (
        <div className="border-b border-l-[3px] border-l-status-current bg-status-current/8 px-4 py-2.5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-status-current">
              <span className="inline-flex h-2 w-2 rounded-full bg-status-current" />
              <span>
                <strong>{pendingViewingRequests.length}</strong>{" "}
                {pendingViewingRequests.length === 1 ? "investor has" : "investors have"} requested a viewing —{" "}
                {pendingViewingRequests
                  .slice(0, 3)
                  .map((t: any) => t.company.name)
                  .join(", ")}
                {pendingViewingRequests.length > 3 ? ` +${pendingViewingRequests.length - 3} more` : ""}
                . Schedule a date and contact them.
              </span>
            </div>
            <button
              className="shrink-0 text-xs font-semibold text-status-current underline-offset-2 hover:underline"
              onClick={() => setSelectedTrackingId(pendingViewingRequests[0].id)}
            >
              Open →
            </button>
          </div>
        </div>
      )}

      {/* Stage summary strip */}
      <div className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dils-200 bg-white px-3.5 py-1.5 text-[13px] text-muted-foreground">
            <span className="font-bold text-foreground">{asset.trackings.length}</span>
            Total
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-status-success/35 bg-status-success-soft px-3.5 py-1.5 text-[13px] font-medium text-status-success">
            <span className="font-bold">{activeCount}</span>
            Active
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-status-danger/30 bg-status-danger-soft px-3.5 py-1.5 text-[13px] font-medium text-status-danger">
            <span className="font-bold">{droppedCount}</span>
            Dropped
          </span>

          <div className="mx-2 h-6 w-px shrink-0 bg-border" />

          {stages.map((stage) => {
            const counts = stageSummary[stage.key] || { completed: 0, inProgress: 0, total: 0 };
            const isFiltered = stageFilter === stage.key;
            return (
              <button
                key={stage.key}
                onClick={() => setStageFilter(isFiltered ? "all" : stage.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  isFiltered
                    ? "border-status-current/40 bg-status-current/10 text-status-current"
                    : "border-dils-200 bg-white text-muted-foreground hover:bg-soft-bg-surface-alt"
                )}
              >
                <span className="font-semibold text-foreground">{stage.label}</span>
                <span className="inline-flex items-center gap-1">
                  {counts.completed > 0 && <span className="inline-block h-2 w-2 rounded-full bg-status-success" />}
                  {counts.inProgress > 0 && <span className="inline-block h-2 w-2 rounded-full bg-status-current" />}
                  {counts.completed === 0 && counts.inProgress === 0 && <span className="inline-block h-2 w-2 rounded-full bg-dils-200" />}
                </span>
                <span className="text-[12px] font-medium text-muted-foreground">
                  {counts.inProgress > 0 ? `${counts.completed}·${counts.inProgress}` : counts.completed}
                </span>
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
