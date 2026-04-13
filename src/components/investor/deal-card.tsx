"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, ChevronRight, FileText, Lock, Check, Clock, Pen } from "lucide-react";
import { cn } from "@/lib/utils";
import { StageStatusValue } from "@prisma/client";

interface DealCardProps {
  tracking: any; // complex nested prisma type
}

function getStageIcon(status: StageStatusValue, hasApproval: boolean) {
  if (status === "COMPLETED" && hasApproval) return <Check className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "COMPLETED") return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  if (status === "IN_PROGRESS") return <Pen className="h-3.5 w-3.5 text-blue-500" />;
  return <Lock className="h-3.5 w-3.5 text-gray-300" />;
}

function getNextAction(stageStatuses: any[], documents: any[]): string {
  const stages = stageStatuses.sort((a: any, b: any) => a.stage.sequence - b.stage.sequence);

  for (const ss of stages) {
    if (ss.status === "IN_PROGRESS") {
      if (documents.some((d: any) => d.stage.key === ss.stage.key)) {
        return `Sign ${ss.stage.label} document`;
      }
      return `${ss.stage.label} in progress`;
    }
    if (ss.status === "COMPLETED" && !ss.approvedAt && ss.stage.key === "nda") {
      return "NDA under review";
    }
  }

  const allCompleted = stages.every((s: any) => s.status === "COMPLETED");
  if (allCompleted) return "All stages complete";

  return "Awaiting next step";
}

export function DealCard({ tracking }: DealCardProps) {
  const nextAction = getNextAction(tracking.stageStatuses, tracking.documents);
  const pendingDocs = tracking.documents?.length ?? 0;

  return (
    <Link
      href={`/portal/${tracking.assetId}`}
      className="flex items-center justify-between rounded-xl border bg-white p-5 transition-all hover:border-gold-300 hover:shadow-sm"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold-100">
          <Building className="h-6 w-6 text-gold-600" />
        </div>
        <div>
          <h3 className="font-semibold">{tracking.asset.title}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {tracking.asset.city}, {tracking.asset.country}
            </span>
            {tracking.asset.assetType && (
              <Badge variant="secondary" className="text-xs">{tracking.asset.assetType}</Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-gold-700 font-medium">{nextAction}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Stage progress mini-dots */}
        <div className="flex items-center gap-1.5">
          {tracking.stageStatuses
            .sort((a: any, b: any) => a.stage.sequence - b.stage.sequence)
            .map((ss: any) => (
              <div key={ss.id} className="flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    ss.status === "COMPLETED" ? "bg-emerald-500" :
                    ss.status === "IN_PROGRESS" ? "bg-blue-500" :
                    "bg-gray-200"
                  )}
                />
              </div>
            ))}
        </div>

        {pendingDocs > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
            <FileText className="mr-1 h-3 w-3" />
            {pendingDocs} to sign
          </Badge>
        )}

        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
    </Link>
  );
}
