"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Building, MapPin, Check, Clock, Lock, Pen, FileText,
  ExternalLink, Download, Eye,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { StageStatusValue } from "@prisma/client";

interface DealJourneyProps {
  tracking: any;
  contents: any[];
}

type StageState = "locked" | "available" | "action_needed" | "pending_review" | "completed";

function getStageState(
  ss: any,
  prevSs: any | null,
  stageKey: string
): StageState {
  if (ss.status === "COMPLETED" && ss.approvedAt) return "completed";
  if (ss.status === "COMPLETED" && !ss.approvedAt) return "pending_review";
  if (ss.status === "IN_PROGRESS") return "action_needed";

  // Check if previous stage allows access
  if (!prevSs) return ss.status === "NOT_STARTED" ? "available" : "locked";
  if (prevSs.status === "COMPLETED" && (prevSs.approvedAt || prevSs.stage.key !== "nda")) {
    return "available";
  }

  return "locked";
}

const STATE_CONFIG: Record<StageState, { icon: any; label: string; color: string; bg: string }> = {
  completed: { icon: Check, label: "Completed", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  pending_review: { icon: Clock, label: "Under Review", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  action_needed: { icon: Pen, label: "Action Needed", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  available: { icon: Eye, label: "Available", color: "text-gray-600", bg: "bg-white border-gray-200" },
  locked: { icon: Lock, label: "Locked", color: "text-gray-400", bg: "bg-gray-50 border-gray-100" },
};

export function DealJourney({ tracking, contents }: DealJourneyProps) {
  const stages = tracking.stageStatuses.sort(
    (a: any, b: any) => a.stage.sequence - b.stage.sequence
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to deals
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold-100">
            <Building className="h-7 w-7 text-gold-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{tracking.asset.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {tracking.asset.address}, {tracking.asset.city}
              </span>
              {tracking.asset.assetType && (
                <Badge variant="secondary">{tracking.asset.assetType}</Badge>
              )}
              {tracking.asset.transactionType && (
                <Badge variant="outline">{tracking.asset.transactionType}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Journey stages */}
      <div className="space-y-4">
        {stages.map((ss: any, idx: number) => {
          const prevSs = idx > 0 ? stages[idx - 1] : null;
          const state = getStageState(ss, prevSs, ss.stage.key);
          const config = STATE_CONFIG[state];
          const Icon = config.icon;

          // Find documents for this stage
          const stageDocs = tracking.documents.filter(
            (d: any) => d.stage.key === ss.stage.key
          );

          // Find content for this stage
          const stageContent = contents.filter(
            (c: any) => c.stageKey === ss.stage.key
          );

          const isExpanded = state !== "locked";

          return (
            <div
              key={ss.id}
              className={cn(
                "rounded-xl border p-5 transition-all",
                config.bg,
                state === "locked" && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg mt-0.5",
                    state === "completed" ? "bg-emerald-100" :
                    state === "action_needed" ? "bg-blue-100" :
                    state === "pending_review" ? "bg-amber-100" :
                    "bg-gray-100"
                  )}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{ss.stage.label}</h3>
                      <Badge variant="outline" className={cn("text-[10px]", config.color)}>
                        {config.label}
                      </Badge>
                    </div>
                    {ss.completedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Completed {formatDate(ss.completedAt)}
                      </p>
                    )}
                    {state === "pending_review" && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Awaiting approval from the deal team
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-sm font-semibold text-muted-foreground">
                  {idx + 1}/{stages.length}
                </span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="mt-4 ml-11 space-y-3">
                  {/* Documents to sign */}
                  {stageDocs.length > 0 && (
                    <div className="space-y-2">
                      {stageDocs.map((doc: any) => {
                        const activeToken = doc.signingTokens?.[0]?.token;
                        return (
                          <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{doc.fileName}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {doc.status === "SIGNED"
                                    ? `Signed on ${formatDate(doc.signedAt)}`
                                    : doc.status === "PENDING"
                                    ? "Awaiting your signature"
                                    : doc.status}
                                </p>
                              </div>
                            </div>
                            {doc.status === "PENDING" && activeToken && (
                              <Link href={`/sign/${activeToken}`} target="_blank">
                                <Button size="sm" className="h-8 text-xs">
                                  <Pen className="mr-1.5 h-3 w-3" />
                                  Sign Now
                                </Button>
                              </Link>
                            )}
                            {doc.status === "SIGNED" && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                                <Check className="mr-1 h-3 w-3" />
                                Signed
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Stage content (IM, etc.) */}
                  {stageContent.length > 0 && (
                    <div className="space-y-2">
                      {stageContent.map((content: any) => (
                        <div key={content.id} className="rounded-lg border bg-white p-4">
                          <h4 className="font-medium text-sm">{content.title}</h4>
                          {content.description && (
                            <p className="text-xs text-muted-foreground mt-1">{content.description}</p>
                          )}
                          {content.contentType === "PDF" && content.fileUrl && (
                            <div className="mt-3">
                              <embed
                                src={content.fileUrl}
                                type="application/pdf"
                                className="w-full rounded-md border"
                                style={{ height: "400px" }}
                              />
                              <a href={content.fileUrl} target="_blank" rel="noopener">
                                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
                                  <Download className="mr-1.5 h-3 w-3" />
                                  Download PDF
                                </Button>
                              </a>
                            </div>
                          )}
                          {content.contentType === "LANDING_PAGE" && content.htmlContent && (
                            <div
                              className="mt-3 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: content.htmlContent }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state for available stages */}
                  {stageDocs.length === 0 && stageContent.length === 0 && state === "available" && (
                    <p className="text-xs text-muted-foreground">
                      No documents or materials available yet for this stage.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
