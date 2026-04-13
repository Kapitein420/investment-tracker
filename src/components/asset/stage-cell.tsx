"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn, formatDate } from "@/lib/utils";
import { STAGE_STATUS_LABELS, STAGE_DOT_COLORS, STAGE_STATUS_COLORS } from "@/lib/stages";
import { updateStageStatus } from "@/actions/tracking-actions";
import { toast } from "sonner";
import { StageStatusValue } from "@prisma/client";

const STATUS_OPTIONS: StageStatusValue[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
  "DECLINED",
];

interface StageCellProps {
  stageStatus: {
    id: string;
    status: StageStatusValue;
    stageId: string;
    completedAt: string | Date | null;
    stage: { key: string; label: string };
  };
  editable: boolean;
  trackingId: string;
}

export function StageCell({ stageStatus, editable, trackingId }: StageCellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleStatusChange(newStatus: StageStatusValue) {
    if (newStatus === stageStatus.status) {
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      await updateStageStatus({
        trackingId,
        stageId: stageStatus.stageId,
        status: newStatus,
      });
      toast.success(`${stageStatus.stage.label}: ${STAGE_STATUS_LABELS[newStatus]}`);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  const dot = <span className={cn("h-2.5 w-2.5 rounded-full", STAGE_DOT_COLORS[stageStatus.status])} />;

  if (!editable) {
    return (
      <div className="flex items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded",
                STAGE_STATUS_COLORS[stageStatus.status]
              )}
            >
              {dot}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{stageStatus.stage.label}: {STAGE_STATUS_LABELS[stageStatus.status]}</p>
            {stageStatus.completedAt && (
              <p className="text-[10px] opacity-80">Completed {formatDate(stageStatus.completedAt)}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded transition-all hover:ring-2 hover:ring-ring/20",
                STAGE_STATUS_COLORS[stageStatus.status]
              )}
            >
              {dot}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{stageStatus.stage.label}: {STAGE_STATUS_LABELS[stageStatus.status]}</p>
            {stageStatus.completedAt && (
              <p className="text-[10px] opacity-80">Completed {formatDate(stageStatus.completedAt)}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="center">
        <div className="px-2 py-1">
          <p className="text-xs font-medium text-muted-foreground">{stageStatus.stage.label}</p>
          {stageStatus.completedAt && (
            <p className="text-[10px] text-muted-foreground/70">Completed {formatDate(stageStatus.completedAt)}</p>
          )}
        </div>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            disabled={loading}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent",
              stageStatus.status === status && "bg-accent"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", STAGE_DOT_COLORS[status])} />
            {STAGE_STATUS_LABELS[status]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
