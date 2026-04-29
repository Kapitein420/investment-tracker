"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, ChevronRight, FileText, Lock, Check, Clock, Pen } from "lucide-react";
import { cn } from "@/lib/utils";
import { assetTypeToUnit } from "@/lib/stages";
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
  const unit = assetTypeToUnit(tracking.asset.assetType);

  const sortedStages = [...tracking.stageStatuses].sort(
    (a: any, b: any) => a.stage.sequence - b.stage.sequence
  );

  return (
    <Link
      href={`/portal/${tracking.assetId}`}
      className="group flex flex-col gap-4 rounded-md border border-dils-200 bg-white p-4 shadow-soft-card transition-all duration-150 hover:-translate-y-px hover:border-soft-office/40 hover:shadow-soft-card-hover sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
    >
      <div className="flex items-start gap-4 min-w-0 sm:items-center">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dils-100", unit.tint)}>
          <Building className="h-6 w-6 text-dils-black" strokeWidth={1.8} />
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
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-banner-info-foreground">
            <ChevronRight className="h-3.5 w-3.5 -ml-0.5" strokeWidth={2.4} />
            {nextAction}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {/* Stage progress: dots with connecting line, soft-enterprise palette */}
        <div className="hidden sm:flex items-start">
          {sortedStages.map((ss: any, idx: number) => {
            const isCompleted = ss.status === "COMPLETED";
            const isCurrent = ss.status === "IN_PROGRESS";
            const isLast = idx === sortedStages.length - 1;
            // Connecting line: green if THIS stage is completed, gray otherwise
            const lineColor = isCompleted ? "bg-status-success" : "bg-dils-100";
            return (
              <div key={ss.id} className="relative flex flex-col items-center gap-1.5" style={{ minWidth: "52px" }}>
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn("absolute top-[7px] left-1/2 h-0.5 w-full", lineColor)}
                  />
                )}
                <span
                  className={cn(
                    "relative z-[1] h-3.5 w-3.5 rounded-full border-2",
                    isCompleted && "border-status-success bg-status-success",
                    isCurrent && "border-status-current bg-status-current ring-4 ring-status-current/15",
                    !isCompleted && !isCurrent && "border-dils-200 bg-white"
                  )}
                />
                <span
                  className={cn(
                    "text-[9px] leading-none tracking-wide",
                    isCompleted && "font-medium text-status-success",
                    isCurrent && "font-semibold text-status-current",
                    !isCompleted && !isCurrent && "text-muted-foreground"
                  )}
                >
                  {ss.stage.label}
                </span>
              </div>
            );
          })}
        </div>

        {pendingDocs > 0 && (
          <Badge className="border-0 bg-status-warning-soft text-status-warning text-xs font-semibold">
            <FileText className="mr-1 h-3 w-3" />
            {pendingDocs} to sign
          </Badge>
        )}

        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-banner-info-foreground" />
      </div>
    </Link>
  );
}
