"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type PipelineStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Check, X as XIcon } from "lucide-react";
import { updatePipelineStage } from "@/actions/admin-actions";
import { toast } from "sonner";

export function StagesAdmin({ stages }: { stages: PipelineStage[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await updatePipelineStage(id, { isActive: !isActive });
      toast.success(isActive ? "Stage deactivated" : "Stage activated");
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    const idx = stages.findIndex((s) => s.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stages.length) return;

    try {
      await updatePipelineStage(stages[idx].id, { sequence: stages[swapIdx].sequence });
      await updatePipelineStage(stages[swapIdx].id, { sequence: stages[idx].sequence });
      toast.success("Reordered");
      router.refresh();
    } catch {
      toast.error("Failed to reorder");
    }
  }

  async function handleSaveLabel(id: string) {
    if (!editLabel.trim()) return;
    try {
      await updatePipelineStage(id, { label: editLabel.trim() });
      toast.success("Label updated");
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline Stages</h1>
        <p className="text-sm text-muted-foreground">Configure the deal pipeline stages</p>
      </div>

      <div className="max-w-lg space-y-2">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-3 rounded-lg border bg-white p-3">
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={idx === 0}
                onClick={() => handleReorder(stage.id, "up")}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={idx === stages.length - 1}
                onClick={() => handleReorder(stage.id, "down")}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex-1">
              {editingId === stage.id ? (
                <div className="flex gap-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="h-8"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveLabel(stage.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button size="icon" className="h-8 w-8" onClick={() => handleSaveLabel(stage.id)}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    setEditingId(stage.id);
                    setEditLabel(stage.label);
                  }}
                >
                  <p className="font-medium text-sm">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">Key: {stage.key} &middot; Sequence: {stage.sequence}</p>
                </div>
              )}
            </div>

            <Badge variant={stage.isActive ? "secondary" : "destructive"} className="text-xs">
              {stage.isActive ? "Active" : "Inactive"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleToggleActive(stage.id, stage.isActive)}
            >
              {stage.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
