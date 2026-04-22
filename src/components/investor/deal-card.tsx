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

  // Check for pending documents that need signing (any stage)
  const pendingSignDoc = documents.find(
    (d: any) => d.status === "PENDING" && d.signingTokens?.length > 0
  );
  if (pendingSignDoc) {
    const stageLabel = pendingSignDoc.stage?.label ?? "document";
    return `Sign your ${stageLabel} to proceed`;
  }

  for (const ss of stages) {
    // NDA completed but awaiting admin approval
    if (ss.status === "COMPLETED" && !ss.approvedAt && ss.stage.key === "nda") {
      return "NDA under review \u2014 we\u2019ll notify you when approved";
    }

    if (ss.status === "IN_PROGRESS") {
      if (ss.stage.key === "im") return "Information Memorandum is now available";
      if (ss.stage.key === "viewing") return "Schedule your property viewing";
      if (ss.stage.key === "nbo") return "Submit your Non-Binding Offer";
      return `${ss.stage.label} \u2014 action required`;
    }

    // If a stage is NOT_STARTED but the previous stage is done, hint at what's next
    if (ss.status === "NOT_STARTED") {
      const prevIdx = stages.indexOf(ss) - 1;
      const prev = prevIdx >= 0 ? stages[prevIdx] : null;
      if (prev && prev.status === "COMPLETED" && (prev.stage.key !== "nda" || prev.approvedAt)) {
        if (ss.stage.key === "im") return "Information Memorandum is now available";
        return `${ss.stage.label} is now available`;
      }
    }
  }

  const allCompleted = stages.every((s: any) => s.status === "COMPLETED");
  if (allCompleted) return "All stages complete \u2014 thank you";

  return "Review the stages below to continue";
}

export function DealCard({ tracking }: DealCardProps) {
  const nextAction = getNextAction(tracking.stageStatuses, tracking.documents);
  const pendingDocs = tracking.documents?.filter((d: any) => d.status === "PENDING").length ?? 0;

  return (
    <Link
      href={`/portal/${tracking.assetId}`}
      className="flex flex-col gap-4 rounded-md border border-dils-200 bg-white p-4 transition-all hover:border-dils-black hover:shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
    >
      <div className="flex items-start gap-4 min-w-0 sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-dils-50 border border-dils-200">
          <Building className="h-6 w-6 text-dils-black" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-dils-black">{tracking.asset.title}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" strokeWidth={2} />
              {tracking.asset.city}, {tracking.asset.country}
            </span>
            {tracking.asset.assetType && (
              <Badge variant="secondary" className="text-xs">{tracking.asset.assetType}</Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-dils-black font-medium">{nextAction}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {/* Stage progress mini-dots with labels (labels hidden on xs) */}
        <div className="flex items-center gap-2">
          {tracking.stageStatuses
            .sort((a: any, b: any) => a.stage.sequence - b.stage.sequence)
            .map((ss: any) => (
              <div key={ss.id} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    ss.status === "COMPLETED" ? "bg-emerald-500" :
                    ss.status === "IN_PROGRESS" ? "bg-blue-500" :
                    "bg-gray-200"
                  )}
                />
                <span className="hidden text-[9px] text-muted-foreground leading-none sm:inline">{ss.stage.label}</span>
              </div>
            ))}
        </div>

        {pendingDocs > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
            <FileText className="mr-1 h-3 w-3" />
            {pendingDocs} to sign
          </Badge>
        )}

        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
