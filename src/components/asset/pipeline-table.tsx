"use client";

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
import { type PipelineStage } from "@prisma/client";
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
import { updateTracking } from "@/actions/tracking-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type TrackingRow = any; // complex nested type from Prisma

interface PipelineTableProps {
  trackings: TrackingRow[];
  stages: PipelineStage[];
  users: Array<{ id: string; name: string }>;
  editable: boolean;
  currentUserId: string;
  onRowClick: (id: string) => void;
}

export function PipelineTable({ trackings, stages, users, editable, currentUserId, onRowClick }: PipelineTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<TrackingRow>[]>(() => {
    const cols: ColumnDef<TrackingRow>[] = [
      {
        accessorKey: "relationshipType",
        header: "Type",
        size: 80,
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
            <span className="font-medium text-sm">{row.original.company.name}</span>
            {isStaleDate(row.original.updatedAt) && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-3 w-3 text-amber-500" />
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

    // Stage columns
    for (const stage of stages) {
      cols.push({
        id: `stage_${stage.key}`,
        header: stage.label,
        size: 90,
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
        header: "Stage",
        size: 80,
        cell: ({ row }) => {
          const key = row.original.currentStageKey;
          const stage = stages.find((s) => s.key === key);
          return stage ? (
            <Badge variant="outline" className="text-xs">{stage.label}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      },
      {
        accessorKey: "lifecycleStatus",
        header: "Lifecycle",
        size: 90,
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
        header: "Owner",
        size: 100,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.ownerUser?.name ?? "-"}
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
    <div className="rounded-md border bg-white">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b transition-colors hover:bg-gray-50/50 cursor-pointer",
                  row.original.lifecycleStatus === "DROPPED" && "opacity-50"
                )}
                onClick={() => onRowClick(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2" onClick={(e) => {
                    // prevent row click when clicking stage cells or actions
                    if (cell.column.id.startsWith("stage_") || cell.column.id === "actions") {
                      e.stopPropagation();
                    }
                  }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
