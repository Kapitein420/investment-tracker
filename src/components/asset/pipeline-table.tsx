"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import { useState } from "react";
import { type PipelineStage, type Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { MoreHorizontal, ArrowUpDown, ChevronRight, MessageSquare, AlertCircle } from "lucide-react";
import { cn, truncate, isStaleDate, formatDate } from "@/lib/utils";
import {
  STAGE_STATUS_LABELS,
  STAGE_DOT_COLORS,
  LIFECYCLE_LABELS,
  LIFECYCLE_COLORS,
} from "@/lib/stages";
import { StageCell } from "@/components/asset/stage-cell";
import { StageSelectCell } from "@/components/asset/stage-select-cell";
import { updateTracking, deleteTracking } from "@/actions/tracking-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type TrackingRow = any; // complex nested type from Prisma

interface PipelineTableProps {
  trackings: TrackingRow[];
  stages: PipelineStage[];
  users: Array<{ id: string; name: string }>;
  editable: boolean;
  currentUserId: string;
  userRole?: Role;
  onRowClick: (id: string) => void;
}

export function PipelineTable({ trackings, stages, users, editable, currentUserId, userRole, onRowClick }: PipelineTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const showPII = userRole !== "VIEWER";

  const columns = useMemo<ColumnDef<TrackingRow>[]>(() => {
    const cols: ColumnDef<TrackingRow>[] = [
      {
        accessorKey: "relationshipType",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8 text-xs" onClick={() => column.toggleSorting()}>
            Type
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        size: 80,
        meta: { cellClass: "hidden md:table-cell" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.relationshipType}</span>
        ),
      },
      {
        accessorFn: (row) => row.company.name,
        id: "company",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8 text-xs" onClick={() => column.toggleSorting()}>
            Company
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        size: 180,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-heading text-base font-semibold tracking-tight text-foreground">{row.original.company.name}</span>
            {isStaleDate(row.original.updatedAt) && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-3 w-3 text-status-warning" />
                </TooltipTrigger>
                <TooltipContent>Not updated in 14+ days</TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        accessorKey: "latestCommentPreview",
        header: "Comments",
        size: 180,
        meta: { cellClass: "hidden lg:table-cell" },
        cell: ({ row }) => {
          const preview = row.original.latestCommentPreview;
          if (!preview) return <span className="text-xs text-muted-foreground">-</span>;
          return (
            <Tooltip>
              <TooltipTrigger className="text-left">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3 flex-shrink-0" />
                  {truncate(preview, 35)}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{preview}</TooltipContent>
            </Tooltip>
          );
        },
      },
    ];

    // Stage columns — hidden on <md (per-stage status visible via "Stage" dropdown column)
    for (const stage of stages) {
      cols.push({
        id: `stage_${stage.key}`,
        header: stage.label,
        size: 90,
        meta: { cellClass: "hidden md:table-cell" },
        cell: ({ row }) => {
          const ss = row.original.stageStatuses.find((s: any) => s.stage.key === stage.key);
          if (!ss) return null;
          return (
            <StageCell
              stageStatus={ss}
              editable={editable}
              trackingId={row.original.id}
            />
          );
        },
      });
    }

    cols.push(
      {
        accessorKey: "currentStageKey",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8 text-xs" onClick={() => column.toggleSorting()}>
            Stage
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        size: 110,
        cell: ({ row }) => (
          <StageSelectCell
            trackingId={row.original.id}
            currentStageKey={row.original.currentStageKey ?? null}
            stages={stages}
            editable={editable}
          />
        ),
      },
      {
        accessorKey: "lifecycleStatus",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8 text-xs" onClick={() => column.toggleSorting()}>
            Lifecycle
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        size: 90,
        meta: { cellClass: "hidden md:table-cell" },
        cell: ({ row }) => {
          const status = row.original.lifecycleStatus as keyof typeof LIFECYCLE_LABELS;
          return (
            <Badge className={cn("text-xs border-0", LIFECYCLE_COLORS[status])}>
              {LIFECYCLE_LABELS[status]}
            </Badge>
          );
        },
      },
      {
        accessorFn: (row) => row.ownerUser?.name ?? "",
        id: "owner",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8 text-xs" onClick={() => column.toggleSorting()}>
            Owner
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        size: 100,
        meta: { cellClass: "hidden lg:table-cell" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.ownerUser ? (showPII ? row.original.ownerUser.name : "DILS team") : "-"}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8 text-xs" onClick={() => column.toggleSorting()}>
            Updated
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        size: 100,
        meta: { cellClass: "hidden md:table-cell" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
        ),
      },
      {
        id: "actions",
        size: 50,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRowClick(row.original.id)}>
                View details
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/assets/${row.original.assetId}/timeline/${row.original.id}`}>
                  View timeline
                </Link>
              </DropdownMenuItem>
              {editable && (
                <>
                  <DropdownMenuSeparator />
                  {row.original.lifecycleStatus === "ACTIVE" ? (
                    <DropdownMenuItem
                      onClick={async () => {
                        await updateTracking(row.original.id, { lifecycleStatus: "DROPPED" });
                        toast.success("Marked as dropped");
                        router.refresh();
                      }}
                      className="text-destructive"
                    >
                      Mark Dropped
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={async () => {
                        await updateTracking(row.original.id, { lifecycleStatus: "ACTIVE" });
                        toast.success("Restored to active");
                        router.refresh();
                      }}
                    >
                      Restore Active
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      // Two-step confirm: deleteTracking cascade-deletes the
                      // company's documents, signing tokens, comments, stage
                      // history, and activity log entries on this asset. No
                      // undo, so we want the admin to type-think before
                      // clicking. ADMIN-only on the server; EDITORs see the
                      // option but get a clear "Forbidden" toast if they try.
                      const company = row.original.company?.name ?? "this company";
                      if (
                        !confirm(
                          `Delete ${company} from this asset?\n\nThis removes the tracking row, all NDA/IM documents, signing tokens, comments, and stage history for this company on this asset. The company itself is not deleted. This can't be undone.`
                        )
                      ) {
                        return;
                      }
                      try {
                        await deleteTracking(row.original.id);
                        toast.success(`${company} removed from this asset`);
                        router.refresh();
                      } catch (e: any) {
                        toast.error(e?.message || "Couldn't delete the tracking");
                      }
                    }}
                    className="text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }
    );

    return cols;
  }, [stages, editable, currentUserId, onRowClick, router]);

  const table = useReactTable({
    data: trackings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (trackings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No matching rows</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-dils-200 bg-white shadow-soft-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-soft-bg-surface-alt backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-dils-200">
                {headerGroup.headers.map((header) => {
                  const cellClass = (header.column.columnDef.meta as { cellClass?: string } | undefined)?.cellClass;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground whitespace-nowrap",
                        cellClass
                      )}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-dils-100 last:border-b-0 transition-colors hover:bg-soft-bg-surface-alt cursor-pointer",
                  row.original.lifecycleStatus === "DROPPED" && "opacity-50"
                )}
                onClick={() => onRowClick(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => {
                  const cellClass = (cell.column.columnDef.meta as { cellClass?: string } | undefined)?.cellClass;
                  return (
                    <td
                      key={cell.id}
                      className={cn("px-3 py-2", cellClass)}
                      onClick={(e) => {
                        // prevent row click when clicking stage cells, stage dropdown, or actions
                        if (
                          cell.column.id.startsWith("stage_") ||
                          cell.column.id === "currentStageKey" ||
                          cell.column.id === "actions"
                        ) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
