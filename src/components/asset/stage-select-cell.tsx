"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PipelineStage } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { updateTracking } from "@/actions/tracking-actions";
import { toast } from "sonner";

interface StageSelectCellProps {
  trackingId: string;
  currentStageKey: string | null;
  stages: PipelineStage[];
  editable: boolean;
}

export function StageSelectCell({
  trackingId,
  currentStageKey,
  stages,
  editable,
}: StageSelectCellProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentStageKey ?? "");

  const current = stages.find((s) => s.key === currentStageKey);

  if (!editable) {
    return current ? (
      <Badge variant="outline" className="text-xs">
        {current.label}
      </Badge>
    ) : (
      <span className="text-xs text-muted-foreground">-</span>
    );
  }

  function handleChange(newKey: string) {
    if (newKey === (currentStageKey ?? "")) return;
    const prev = value;
    setValue(newKey);
    startTransition(async () => {
      try {
        await updateTracking(trackingId, {
          currentStageKey: newKey,
          currentStageManualOverride: true,
        });
        const label = stages.find((s) => s.key === newKey)?.label ?? newKey;
        toast.success(`Moved to ${label}`);
        router.refresh();
      } catch (e: any) {
        // Surface the actual error so the admin can see whether it's a
        // permission / validation / DB issue instead of a generic toast
        // that hides the cause.
        const detail = e?.message ?? String(e);
        toast.error(`Failed to update stage: ${detail}`);
        console.error("[StageSelectCell] updateTracking failed:", e);
        setValue(prev);
      }
    });
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger
        className="h-7 w-full px-2 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="—">{current?.label ?? "—"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {stages.map((stage) => (
          <SelectItem key={stage.key} value={stage.key} className="text-xs">
            {stage.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
