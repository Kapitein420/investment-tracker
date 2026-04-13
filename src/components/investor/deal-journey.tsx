"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Building, MapPin, Check, Clock, Lock, Pen, FileText,
  Download, Eye, ChevronDown, ShieldCheck,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { StageStatusValue } from "@prisma/client";
import { SigningModal } from "@/components/investor/signing-modal";
import { getSignedDocumentUrl } from "@/actions/document-actions";
import { toast } from "sonner";

interface DealJourneyProps {
  tracking: any;
  contents: any[];
}

type StageState = "locked" | "available" | "action_needed" | "pending_review" | "completed";

function getStageState(ss: any, prevSs: any | null): StageState {
  // Only NDA requires admin approval; other stages complete normally
  const needsApproval = ss.stage.key === "nda";

  if (ss.status === "COMPLETED") {
    if (needsApproval && !ss.approvedAt) return "pending_review";
    return "completed";
  }
  if (ss.status === "IN_PROGRESS") return "action_needed";

  // Check if previous stage allows access
  if (!prevSs) return ss.status === "NOT_STARTED" ? "available" : "locked";

  // Previous stage must be completed; NDA specifically needs approval
  if (prevSs.status === "COMPLETED") {
    if (prevSs.stage.key === "nda" && !prevSs.approvedAt) return "locked";
    return "available";
  }
  return "locked";
}

const STATE_CONFIG: Record<StageState, { icon: any; label: string; color: string; bg: string; hint: string }> = {
  completed: { icon: Check, label: "Completed", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", hint: "This stage has been completed and approved." },
  pending_review: { icon: Clock, label: "Under Review", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", hint: "Your submission is being reviewed by the deal team. You'll be notified once approved." },
  action_needed: { icon: Pen, label: "Action Needed", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", hint: "This stage requires your action. Please review and complete the items below." },
  available: { icon: Eye, label: "Available", color: "text-gray-600", bg: "bg-white border-gray-200", hint: "This stage is available but no materials have been shared yet." },
  locked: { icon: Lock, label: "Locked", color: "text-gray-400", bg: "bg-gray-50 border-gray-100", hint: "Complete the previous stage to unlock this one." },
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  teaser: "An introductory overview of the investment opportunity.",
  nda: "Non-Disclosure Agreement — required before accessing detailed materials.",
  im: "The Information Memorandum with full details on the opportunity.",
  viewing: "Schedule and attend a property viewing or presentation.",
  nbo: "Submit a Non-Binding Offer to express your interest.",
};

export function DealJourney({ tracking, contents }: DealJourneyProps) {
  const stages = tracking.stageStatuses.sort(
    (a: any, b: any) => a.stage.sequence - b.stage.sequence
  );

  const [signingDoc, setSigningDoc] = useState<any>(null);
  const [signingToken, setSigningToken] = useState<string>("");

  // Progress calculation
  const completedCount = stages.filter((s: any) => s.status === "COMPLETED").length;
  const progressPct = Math.round((completedCount / stages.length) * 100);

  async function handleDownload(docId: string) {
    try {
      const url = await getSignedDocumentUrl(docId);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to get download link");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to deals
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold-100">
            <Building className="h-7 w-7 text-gold-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{tracking.asset.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {tracking.asset.address}, {tracking.asset.city}
              </span>
              {tracking.asset.assetType && (
                <Badge variant="secondary">{tracking.asset.assetType}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm text-muted-foreground">{completedCount} of {stages.length} stages</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Next step guidance */}
      <div className="mb-6 rounded-lg border bg-gold-50/50 border-gold-200 p-4">
        <p className="text-sm text-gold-800">
          {stages.every((s: any) => s.status === "COMPLETED")
            ? "All stages are complete. Thank you for your participation in this investment process."
            : stages.find((s: any) => s.status === "IN_PROGRESS")
              ? `Next step: ${stages.find((s: any) => s.status === "IN_PROGRESS").stage.label} — action required`
              : "Review the stages below to continue through the investment process."
          }
        </p>
      </div>

      {/* Journey stages */}
      <div className="space-y-3">
        {stages.map((ss: any, idx: number) => {
          const prevSs = idx > 0 ? stages[idx - 1] : null;
          const state = getStageState(ss, prevSs);
          const config = STATE_CONFIG[state];
          const Icon = config.icon;

          const stageDocs = tracking.documents.filter((d: any) => d.stage.key === ss.stage.key);
          const stageContent = contents.filter((c: any) => c.stageKey === ss.stage.key);
          const isExpanded = state !== "locked";
          const description = STAGE_DESCRIPTIONS[ss.stage.key] || "";

          return (
            <div
              key={ss.id}
              className={cn(
                "rounded-xl border transition-all",
                config.bg,
                state === "locked" && "opacity-50"
              )}
            >
              {/* Stage header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg mt-0.5",
                      state === "completed" ? "bg-emerald-100" :
                      state === "action_needed" ? "bg-blue-100" :
                      state === "pending_review" ? "bg-amber-100" :
                      "bg-gray-100"
                    )}>
                      <Icon className={cn("h-4.5 w-4.5", config.color)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base">{ss.stage.label}</h3>
                        <Badge variant="outline" className={cn("text-[10px] font-medium", config.color)}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                      {ss.completedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Completed {formatDate(ss.completedAt)}
                          {ss.approvedAt && (
                            <span className="text-emerald-600 ml-1">
                              &middot; Approved {formatDate(ss.approvedAt)}
                            </span>
                          )}
                        </p>
                      )}
                      {state === "pending_review" && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {config.hint}
                        </p>
                      )}
                      {state === "locked" && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          {config.hint}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground mt-1">
                    {idx + 1}/{stages.length}
                  </span>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (stageDocs.length > 0 || stageContent.length > 0) && (
                <div className="px-5 pb-5 ml-12 space-y-3">
                  {/* Documents */}
                  {stageDocs.map((doc: any) => {
                    const activeToken = doc.signingTokens?.[0]?.token;
                    return (
                      <div key={doc.id} className="rounded-lg border bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{doc.fileName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {doc.status === "SIGNED"
                                  ? `Signed by ${doc.signedByName} on ${formatDate(doc.signedAt)}`
                                  : doc.status === "PENDING"
                                  ? "Awaiting your signature"
                                  : doc.status}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {doc.status === "PENDING" && activeToken && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSigningDoc(doc);
                                  setSigningToken(activeToken);
                                }}
                              >
                                <Pen className="mr-1.5 h-3.5 w-3.5" />
                                Sign Now
                              </Button>
                            )}
                            {doc.status === "SIGNED" && (
                              <>
                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                                  <Check className="mr-1 h-3 w-3" />Signed
                                </Badge>
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleDownload(doc.id)}>
                                  <Download className="mr-1 h-3 w-3" />
                                  Download
                                </Button>
                              </>
                            )}
                            {doc.status === "REJECTED" && (
                              <Badge className="bg-red-100 text-red-700 border-0 text-xs">Declined</Badge>
                            )}
                          </div>
                        </div>

                        {/* Signature preview for signed docs */}
                        {doc.status === "SIGNED" && doc.signatureData && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-[10px] text-muted-foreground mb-1">Signature on file</p>
                            <img src={doc.signatureData} alt="Signature" className="h-10 opacity-70" />
                          </div>
                        )}
                        {doc.status === "REJECTED" && (
                          <div className="mt-2 rounded bg-red-50 px-3 py-2">
                            <p className="text-xs text-red-700">
                              You declined this document. Contact the deal team if you'd like to reconsider.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Content (IM materials etc.) */}
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
                        <div className="mt-3 prose prose-sm max-w-none">
                          {/* Render as plain text for security — use markdown renderer for rich content */}
                          <p className="whitespace-pre-wrap">{content.htmlContent}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state — richer teaser or generic message */}
              {isExpanded && stageDocs.length === 0 && stageContent.length === 0 && (
                <div className="px-5 pb-5 ml-12">
                  {ss.stage.key === "teaser" ? (
                    <div className="rounded-lg border bg-white p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 rounded-lg bg-gold-100 flex items-center justify-center">
                          <Building className="h-8 w-8 text-gold-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{tracking.asset.title}</h4>
                          <p className="text-sm text-muted-foreground">{tracking.asset.address}, {tracking.asset.city}, {tracking.asset.country}</p>
                        </div>
                      </div>
                      {tracking.asset.assetType && (
                        <div className="flex gap-2">
                          <Badge variant="secondary">{tracking.asset.assetType}</Badge>
                          {tracking.asset.transactionType && <Badge variant="outline">{tracking.asset.transactionType}</Badge>}
                        </div>
                      )}
                      {tracking.asset.description && (
                        <p className="text-sm text-muted-foreground">{tracking.asset.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground italic">
                        You have been invited to review this investment opportunity. Proceed to the NDA stage to access detailed materials.
                      </p>
                    </div>
                  ) : state === "action_needed" ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm text-blue-800 font-medium">Waiting for documents</p>
                      <p className="text-xs text-blue-600 mt-1">
                        The deal team is preparing the documents for this stage. You'll be able to proceed once they're ready.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No materials available yet. The deal team will share documents when ready.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Signing Modal */}
      {signingDoc && (
        <SigningModal
          open={!!signingDoc}
          onOpenChange={(open) => { if (!open) setSigningDoc(null); }}
          document={signingDoc}
          token={signingToken}
          companyName={tracking.company.name}
          assetTitle={tracking.asset.title}
          defaultName={tracking.company.contactName || tracking.company.name}
          defaultEmail={tracking.company.contactEmail || ""}
        />
      )}
    </div>
  );
}
