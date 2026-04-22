"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn, formatDate } from "@/lib/utils";
import { STAGE_STATUS_LABELS, STAGE_DOT_COLORS } from "@/lib/stages";
import { updateStageStatus } from "@/actions/tracking-actions";
import { toast } from "sonner";
import { StageStatusValue } from "@prisma/client";
import { Check, Minus, Clock, Ban, X } from "lucide-react";

const STATUS_OPTIONS: StageStatusValue[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
  "DECLINED",
];

const STATUS_ICON: Record<StageStatusValue, React.ReactNode> = {
  NOT_STARTED: <Minus className="h-3 w-3 text-muted-foreground" />,
  IN_PROGRESS: <Clock className="h-3 w-3 text-status-info" />,
  COMPLETED: <Check className="h-3 w-3 text-status-success" />,
  BLOCKED: <Ban className="h-3 w-3 text-status-warning" />,
  DECLINED: <X className="h-3 w-3 text-status-danger" />,
};

const STATUS_BG: Record<StageStatusValue, string> = {
  NOT_STARTED: "bg-muted hover:bg-border",
  IN_PROGRESS: "bg-office-soft hover:bg-office/20 ring-1 ring-office/30",
  COMPLETED: "bg-logistics-soft hover:bg-logistics/20 ring-1 ring-logistics/30",
  BLOCKED: "bg-retail-soft hover:bg-retail/20 ring-1 ring-retail/30",
  DECLINED: "bg-destructive/10 hover:bg-destructive/15 ring-1 ring-destructive/20",
};

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

  const icon = STATUS_ICON[stageStatus.status];
  const bg = STATUS_BG[stageStatus.status];

  const tooltipBody = (
    <>
      <p className="font-medium text-xs">{stageStatus.stage.label}</p>
      <p className="text-[10px] opacity-80">{STAGE_STATUS_LABELS[stageStatus.status]}</p>
      {stageStatus.completedAt && (
        <p className="text-[10px] opacity-60">{formatDate(stageStatus.completedAt)}</p>
      )}
    </>
  );

  if (!editable) {
    return (
      <div className="flex items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors", bg)}>
              {icon}
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipBody}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md transition-all cursor-pointer", bg)}>
              {icon}
            </button>
          </TooltipTrigger>
          <TooltipContent>{tooltipBody}</TooltipContent>
        </Tooltip>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1.5" align="center">
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{stageStatus.stage.label}</p>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            disabled={loading}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
              stageStatus.status === status && "bg-accent font-medium"
            )}
          >
            {STATUS_ICON[status]}
            <span>{STAGE_STATUS_LABELS[status]}</span>
            {status === stageStatus.status && stageStatus.completedAt && (
              <span className="ml-auto text-[10px] text-muted-foreground">{formatDate(stageStatus.completedAt)}</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
