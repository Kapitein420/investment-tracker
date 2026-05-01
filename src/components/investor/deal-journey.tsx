"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Building, MapPin, Calendar, Check, Clock, Lock, Pen, FileText, FileSpreadsheet,
  Download, Eye, ChevronRight, Mail,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { assetTypeToUnit } from "@/lib/stages";
import { orderedHighlightEntries } from "@/lib/highlights";
import { SigningModal } from "@/components/investor/signing-modal";
import { getSignedDocumentUrl } from "@/actions/document-actions";
import { recordInvestorStageEvent, requestViewing } from "@/actions/portal-actions";
import { toast } from "sonner";

interface DealJourneyProps {
  tracking: any;
  contents: any[];
}

type StageState = "locked" | "available" | "action_needed" | "pending_review" | "completed";

function getStageState(ss: any, prevSs: any | null, allStages?: any[]): StageState {
  // Only NDA requires admin approval; other stages complete normally
  const needsApproval = ss.stage.key === "nda";

  if (ss.status === "COMPLETED") {
    if (needsApproval && !ss.approvedAt) return "pending_review";
    return "completed";
  }
  if (ss.status === "IN_PROGRESS") return "action_needed";

  // Viewing unlocks alongside IM as soon as the NDA is signed AND approved
  // — investors shouldn't have to mark the IM "completed" before they can
  // ask for a viewing. Both status + approvedAt are required because the
  // delete-NDA flow preserves approvedAt (so re-sign auto-re-approves) but
  // the in-between state should NOT keep IM/Viewing unlocked.
  if (ss.stage.key === "viewing" && allStages) {
    const ndaSs = allStages.find((s) => s.stage?.key === "nda");
    if (ndaSs?.approvedAt && ndaSs?.status === "COMPLETED") return "available";
  }

  // Check if previous stage allows access
  if (!prevSs) return ss.status === "NOT_STARTED" ? "available" : "locked";

  // Previous stage must be completed; NDA specifically needs approval.
  // If the NDA has been signed (COMPLETED) but not yet admin-approved, show
  // the next stage (IM) as pending_review so the investor understands the
  // deal team is reviewing their NDA, not that they need to do something.
  if (prevSs.status === "COMPLETED") {
    if (prevSs.stage.key === "nda" && !prevSs.approvedAt) return "pending_review";
    return "available";
  }
  return "locked";
}

const STATE_CONFIG: Record<StageState, { icon: any; label: string; cardBorder: string; iconBg: string; iconColor: string; pillBg: string; pillText: string; hint: string }> = {
  completed: {
    icon: Check,
    label: "Completed",
    cardBorder: "border-status-success/35",
    iconBg: "bg-status-success-soft",
    iconColor: "text-status-success",
    pillBg: "bg-status-success-soft",
    pillText: "text-status-success",
    hint: "This stage has been completed and approved.",
  },
  pending_review: {
    icon: Clock,
    label: "Under Review",
    cardBorder: "border-status-warning/35",
    iconBg: "bg-status-warning-soft",
    iconColor: "text-status-warning",
    pillBg: "bg-status-warning-soft",
    pillText: "text-status-warning",
    hint: "Your submission is being reviewed by the deal team. You'll be notified once approved.",
  },
  action_needed: {
    icon: Pen,
    label: "Action Needed",
    cardBorder: "border-status-current/35 shadow-soft-card-hover",
    iconBg: "bg-status-current/10",
    iconColor: "text-status-current",
    pillBg: "bg-status-current/10",
    pillText: "text-status-current",
    hint: "This stage requires your action. Please review and complete the items below.",
  },
  available: {
    icon: Eye,
    label: "Available",
    cardBorder: "border-dils-200",
    iconBg: "bg-soft-bg-surface-alt",
    iconColor: "text-muted-foreground",
    pillBg: "bg-soft-bg-surface-alt",
    pillText: "text-muted-foreground",
    hint: "This stage is available but no materials have been shared yet.",
  },
  locked: {
    icon: Lock,
    label: "Locked",
    cardBorder: "border-dils-100",
    iconBg: "bg-white border border-dils-200",
    iconColor: "text-muted-foreground",
    pillBg: "bg-transparent border border-dils-200",
    pillText: "text-muted-foreground",
    hint: "Complete the previous stage to unlock this one.",
  },
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  teaser: "An introductory overview of the investment opportunity.",
  nda: "Non-Disclosure Agreement — required before accessing detailed materials.",
  im: "The Information Memorandum with full details on the opportunity.",
  viewing: "Schedule and attend a property viewing or presentation.",
  nbo: "Submit a Non-Binding Offer to express your interest.",
};

const NEXT_STEP_TITLES: Record<string, string> = {
  teaser: "Review the teaser",
  nda: "Sign the Non-Disclosure Agreement",
  im: "Review the Information Memorandum",
  viewing: "Schedule your property viewing",
  nbo: "Submit your Non-Binding Offer",
};

export function DealJourney({ tracking, contents }: DealJourneyProps) {
  const router = useRouter();
  // Optimistically mark the teaser as COMPLETED on the very first render —
  // landing on this page IS opening the teaser, so the investor never
  // needs to click anything for that stage. The fire-and-forget OPENED
  // event below makes the same transition server-side; this just keeps
  // the UI from flashing "Action needed" before the server round-trips.
  const stages = tracking.stageStatuses
    .map((ss: any) => {
      if (ss.stage?.key === "teaser" && ss.status !== "COMPLETED") {
        return {
          ...ss,
          status: "COMPLETED",
          completedAt: ss.completedAt ?? new Date(),
        };
      }
      return ss;
    })
    .sort((a: any, b: any) => a.stage.sequence - b.stage.sequence);

  const [signingDoc, setSigningDoc] = useState<any>(null);
  const [signingToken, setSigningToken] = useState<string>("");
  const [requestingViewing, startRequestViewing] = useTransition();

  function handleRequestViewing() {
    startRequestViewing(async () => {
      try {
        const result = await requestViewing(tracking.id);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't send the request");
          return;
        }
        if (result.alreadyRequested) {
          toast.info("Viewing already requested — broker will be in touch");
        } else {
          toast.success("Viewing requested. The broker will contact you to schedule a date.");
        }
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't send the request");
      }
    });
  }

  // Progress calculation
  const completedCount = stages.filter((s: any) => s.status === "COMPLETED").length;
  const unit = assetTypeToUnit(tracking.asset.assetType);

  // Determine the next-action stage for the CTA card
  const nextActionStage = stages.find((s: any) => s.status === "IN_PROGRESS")
    ?? stages.find((s: any, idx: number) => {
      const prev = idx > 0 ? stages[idx - 1] : null;
      return getStageState(s, prev, stages) === "available";
    });
  const nextStateKey = nextActionStage?.stage?.key as string | undefined;
  const allCompleted = stages.every((s: any) => s.status === "COMPLETED");

  // Fire-and-forget: record that the investor has opened this deal page.
  // - TEASER is the first thing they see, so opening the portal page for
  //   this asset is equivalent to "opened the teaser". We only fire once
  //   per page load; the server refuses to regress past COMPLETED.
  // - IM is read-only content embedded on the page, so if the IM stage is
  //   visible (NDA already approved) we also register a VIEWED_DOCUMENT
  //   so the deal team sees the investor has actually looked at it.
  const fireOnceRef = useRef(false);
  useEffect(() => {
    if (fireOnceRef.current) return;
    fireOnceRef.current = true;

    const trackingId = tracking.id;

    recordInvestorStageEvent({
      trackingId,
      stageKey: "teaser",
      event: "OPENED",
    }).catch(() => {});

    const imStage = stages.find((s: any) => s.stage.key === "im");
    const ndaStage = stages.find((s: any) => s.stage.key === "nda");
    const imUnlocked =
      imStage &&
      (imStage.status === "IN_PROGRESS" ||
        imStage.status === "COMPLETED" ||
        (ndaStage?.status === "COMPLETED" && ndaStage?.approvedAt));

    if (imUnlocked) {
      recordInvestorStageEvent({
        trackingId,
        stageKey: "im",
        event: "VIEWED_DOCUMENT",
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDownload(docId: string, stageKey?: string) {
    try {
      const url = await getSignedDocumentUrl(docId);
      window.open(url, "_blank");
      if (stageKey) {
        recordInvestorStageEvent({
          trackingId: tracking.id,
          stageKey,
          event: "DOWNLOADED",
        }).catch(() => {});
      }
    } catch {
      toast.error("Failed to get download link");
    }
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2.4} />
        Back to deals
      </Link>

      {/* Asset header */}
      <div className="mb-7 flex items-start gap-4">
        <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-md", unit.tint)}>
          <Building className="h-7 w-7 text-dils-black" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="dils-accent inline-block font-heading text-3xl font-semibold tracking-tight text-dils-black sm:text-[34px]">
            {tracking.asset.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
              {tracking.asset.address}, {tracking.asset.city}
            </span>
            {tracking.asset.assetType && (
              <span className="inline-flex items-center rounded border border-soft-office/30 bg-soft-office-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em] text-soft-office">
                {tracking.asset.assetType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal stage timeline (the new at-a-glance view) */}
      <section className="mb-5 rounded-xl border border-dils-200 bg-white p-5 shadow-soft-card sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your progress</span>
          <span className="text-[13px] text-muted-foreground">
            <strong className="font-bold text-foreground">{completedCount} of {stages.length}</strong> stages complete
          </span>
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}>
          {stages.map((ss: any, idx: number) => {
            const prevSs = idx > 0 ? stages[idx - 1] : null;
            const state = getStageState(ss, prevSs, stages);
            const isDone = state === "completed";
            const isCurrent = state === "action_needed" || state === "pending_review";
            const isLast = idx === stages.length - 1;
            const lineColor = isDone ? "bg-status-success" : "bg-dils-100";
            return (
              <div key={ss.id} className="relative flex flex-col items-center gap-2 z-[1]">
                {!isLast && (
                  <span aria-hidden className={cn("absolute top-[10px] left-1/2 h-0.5 w-full z-0", lineColor)} />
                )}
                <span
                  className={cn(
                    "relative z-[2] flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-all",
                    isDone && "bg-status-success border-status-success text-white",
                    isCurrent && "bg-status-current border-status-current text-white ring-4 ring-status-current/15",
                    !isDone && !isCurrent && "bg-white border-dils-200 text-muted-foreground"
                  )}
                >
                  {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
                  {isCurrent && state === "action_needed" && <Pen className="h-2.5 w-2.5" strokeWidth={2.5} />}
                  {isCurrent && state === "pending_review" && <Clock className="h-2.5 w-2.5" strokeWidth={2.5} />}
                  {!isDone && !isCurrent && <Lock className="h-2.5 w-2.5" strokeWidth={2.4} />}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-wide text-center",
                    isDone && "text-status-success",
                    isCurrent && "text-status-current font-bold",
                    !isDone && !isCurrent && "text-muted-foreground"
                  )}
                >
                  {ss.stage.label}
                </span>
                <span className="text-[10px] text-muted-foreground -mt-1 text-center">
                  {isDone && ss.completedAt ? formatDate(ss.completedAt) : ""}
                  {isCurrent && state === "action_needed" ? "Action needed" : ""}
                  {isCurrent && state === "pending_review" ? "Under review" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Next-step CTA card */}
      {!allCompleted && nextActionStage && (
        <a
          href={`#stage-${nextActionStage.id}`}
          className="mb-6 flex flex-col items-start gap-4 rounded-lg border border-banner-info-foreground/25 border-l-[4px] border-l-banner-info-foreground bg-gradient-to-b from-banner-info to-banner-info/40 p-5 shadow-soft-card transition-shadow hover:shadow-soft-card-hover sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-banner-info-foreground/80">Next step</p>
            <h2 className="mt-1 font-heading text-lg font-semibold tracking-tight text-banner-info-foreground">
              {NEXT_STEP_TITLES[nextStateKey ?? ""] ?? `${nextActionStage.stage.label} — action required`}
            </h2>
            <p className="mt-1 text-[13px] text-banner-info-foreground/85">
              {STAGE_DESCRIPTIONS[nextStateKey ?? ""] ?? "Continue through the investment process below."}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-md bg-banner-info-foreground px-4 py-2.5 text-[13px] font-semibold text-white transition-[filter] group-hover:brightness-110 hover:brightness-110">
            Open {nextActionStage.stage.label}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
        </a>
      )}
      {allCompleted && (
        <div className="mb-6 rounded-lg border border-status-success/30 border-l-[4px] border-l-status-success bg-status-success-soft p-5 shadow-soft-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-status-success/80">All done</p>
          <h2 className="mt-1 font-heading text-lg font-semibold tracking-tight text-status-success">
            All stages complete
          </h2>
          <p className="mt-1 text-[13px] text-status-success/90">
            Thank you for your participation in this investment process.
          </p>
        </div>
      )}

      {/* Journey stages */}
      <div className="space-y-3.5">
        {stages.map((ss: any, idx: number) => {
          const prevSs = idx > 0 ? stages[idx - 1] : null;
          const state = getStageState(ss, prevSs, stages);
          const config = STATE_CONFIG[state];
          const Icon = config.icon;

          const stageDocs = tracking.documents.filter((d: any) => d.stage.key === ss.stage.key);
          const stageContent = stageDocs.length > 0
            ? []
            : contents.filter((c: any) => {
                if (c.stageKey !== ss.stage.key) return false;
                if (ss.stage.key === "teaser" && c.contentType === "LANDING_PAGE") return false;
                // The HTML NDA template is stored as a LANDING_PAGE
                // AssetContent (contentType + isHtmlNda flag in keyMetrics).
                // Investors sign via the signing modal, not by reading the
                // raw template — exclude it from the journey card so they
                // don't see the source HTML rendered as text.
                if (c.keyMetrics && (c.keyMetrics as any).isHtmlNda) return false;
                return true;
              });
          const isExpanded = state !== "locked";
          const description = STAGE_DESCRIPTIONS[ss.stage.key] || "";

          return (
            <div
              id={`stage-${ss.id}`}
              key={ss.id}
              className={cn(
                "overflow-hidden rounded-xl border bg-white shadow-soft-card transition-all",
                config.cardBorder,
                state === "locked" && "bg-soft-bg-surface-alt shadow-none opacity-75",
                state === "pending_review" && "bg-gradient-to-b from-status-warning-soft/50 to-white"
              )}
            >
              {/* Stage header */}
              <div className={cn("flex items-start gap-3.5 px-5 py-4 sm:px-6 sm:py-5", isExpanded && "border-b border-dils-100")}>
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                  config.iconBg
                )}>
                  <Icon className={cn("h-[18px] w-[18px]", config.iconColor)} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={cn(
                      "font-heading text-lg font-semibold tracking-tight text-foreground",
                      state === "locked" && "font-sans text-base text-muted-foreground"
                    )}>
                      {ss.stage.label}
                    </h3>
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]",
                      config.pillBg,
                      config.pillText
                    )}>
                      {config.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
                  {ss.completedAt && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Completed {formatDate(ss.completedAt)}
                      {ss.approvedAt && (
                        <span className="text-status-success font-semibold ml-1">
                          · Approved {formatDate(ss.approvedAt)}
                        </span>
                      )}
                    </p>
                  )}
                  {state === "pending_review" && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-status-warning">
                      <Clock className="h-3 w-3" strokeWidth={2.2} />
                      {ss.stage.key === "nda"
                        ? config.hint
                        : "Waiting for the deal team to review your NDA. You'll be notified once approved."}
                    </p>
                  )}
                  {state === "locked" && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" strokeWidth={2.2} />
                      {config.hint}
                    </p>
                  )}
                </div>
                <span className="shrink-0 self-start text-xs font-semibold text-muted-foreground">
                  {idx + 1} / {stages.length}
                </span>
              </div>

              {/* Expanded content */}
              {isExpanded && (stageDocs.length > 0 || stageContent.length > 0) && (
                <div className="space-y-3 px-5 py-4 sm:px-6 sm:py-5">
                  {/* Documents */}
                  {stageDocs.map((doc: any) => {
                    const activeToken = doc.signingTokens?.[0]?.token;
                    const stageAlreadyDone = ss.status === "COMPLETED";
                    const canSign = doc.status === "PENDING" && activeToken && !stageAlreadyDone;

                    return (
                      <div key={doc.id} className="flex flex-col gap-3 rounded-md border border-dils-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px]",
                            doc.status === "SIGNED" ? "bg-status-success-soft text-status-success" : "bg-status-current/10 text-status-current"
                          )}>
                            <FileText className="h-[18px] w-[18px]" strokeWidth={1.8} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{doc.fileName}</p>
                            <p className={cn(
                              "text-xs mt-0.5",
                              doc.status === "SIGNED" ? "text-status-success font-medium" : "text-muted-foreground"
                            )}>
                              {doc.status === "SIGNED"
                                ? `Signed by ${doc.signedByName} on ${formatDate(doc.signedAt)}`
                                : stageAlreadyDone
                                ? "Stage completed"
                                : doc.status === "PENDING"
                                ? "Awaiting your signature"
                                : doc.status}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {canSign && (
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => {
                                if (doc.mimeType === "text/html") {
                                  window.location.href = `/sign/${activeToken}`;
                                } else {
                                  setSigningDoc(doc);
                                  setSigningToken(activeToken);
                                }
                              }}
                            >
                              <Pen className="mr-1.5 h-3.5 w-3.5" />
                              Sign Now
                            </Button>
                          )}
                          {doc.status === "SIGNED" && (
                            <>
                              <Badge className="border-0 bg-status-success-soft text-status-success text-xs font-semibold">
                                <Check className="mr-1 h-3 w-3" strokeWidth={2.6} />Signed
                              </Badge>
                              {doc.mimeType === "text/html" ? (
                                <>
                                  <Link href={`/portal/signed-nda/${doc.id}`}>
                                    <Button variant="outline" size="sm" className="h-8 text-xs">
                                      <Eye className="mr-1 h-3 w-3" />
                                      View
                                    </Button>
                                  </Link>
                                  <Link href={`/portal/signed-nda/${doc.id}?download=1`} target="_blank">
                                    <Button variant="outline" size="sm" className="h-8 text-xs">
                                      <Download className="mr-1 h-3 w-3" />
                                      Download
                                    </Button>
                                  </Link>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => handleDownload(doc.id, ss.stage.key)}
                                >
                                  <Download className="mr-1 h-3 w-3" />
                                  Download
                                </Button>
                              )}
                            </>
                          )}
                          {doc.status === "REJECTED" && (
                            <Badge className="border-0 bg-status-danger-soft text-status-danger text-xs font-semibold">Declined</Badge>
                          )}
                        </div>

                        {/* Signature image is intentionally NOT rendered here.
                            Investors can verify the signed document via the
                            "View" / "Download" buttons above; surfacing the
                            raw signature on the journey overview made the
                            page feel less safe. */}
                        {doc.status === "REJECTED" && (
                          <div className="w-full mt-2 rounded-md bg-status-danger-soft px-3 py-2">
                            <p className="text-xs text-status-danger">
                              You declined this document. Contact the deal team if you'd like to reconsider.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Content (IM materials etc.) */}
                  {stageContent.map((content: any) => {
                    const isRentRoll = (content.keyMetrics as any)?.isRentRoll === true;
                    return (
                    <div key={content.id} className="overflow-hidden rounded-lg border border-dils-200 bg-white">
                      <div className="flex items-center justify-between gap-3 border-b border-dils-100 bg-soft-bg-surface-alt px-4 py-3">
                        <h4 className="inline-flex items-center gap-2 font-semibold text-banner-info-foreground text-sm">
                          {isRentRoll ? (
                            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={2} />
                          ) : (
                            <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                          {isRentRoll ? "Rent Roll" : content.title}
                        </h4>
                        {content.contentType === "PDF" && content.fileUrl && (
                          <div className="flex items-center gap-2">
                            {!isRentRoll && (
                              <a
                                href={content.fileUrl}
                                target="_blank"
                                rel="noopener"
                                onClick={() => {
                                  recordInvestorStageEvent({
                                    trackingId: tracking.id,
                                    stageKey: ss.stage.key,
                                    event: "DOWNLOADED",
                                  }).catch(() => {});
                                }}
                              >
                                <Button variant="outline" size="sm" className="h-8 text-xs">
                                  <Eye className="mr-1.5 h-3 w-3" />
                                  Open
                                </Button>
                              </a>
                            )}
                            <a
                              // The HTML `download` attribute is ignored on
                              // cross-origin URLs (which Supabase signed URLs
                              // are), so the browser would just open the PDF
                              // inline. Append Supabase's `?download=name`
                              // query so the storage layer responds with
                              // Content-Disposition: attachment instead.
                              href={(() => {
                                const url = content.fileUrl as string;
                                const sep = url.includes("?") ? "&" : "?";
                                const fname = encodeURIComponent(
                                  content.fileName ??
                                    (isRentRoll ? `${content.title}.xlsx` : `${content.title}.pdf`)
                                );
                                return `${url}${sep}download=${fname}`;
                              })()}
                              onClick={() => {
                                recordInvestorStageEvent({
                                  trackingId: tracking.id,
                                  stageKey: ss.stage.key,
                                  event: "DOWNLOADED",
                                }).catch(() => {});
                              }}
                            >
                              <Button size="sm" className="h-8 bg-banner-info-foreground text-white hover:bg-banner-info-foreground/90 text-xs">
                                <Download className="mr-1.5 h-3 w-3" />
                                Download
                              </Button>
                            </a>
                          </div>
                        )}
                      </div>
                      {content.description && !isRentRoll && (
                        <p className="px-4 pt-3 text-xs text-muted-foreground">{content.description}</p>
                      )}
                      {content.contentType === "PDF" && content.fileUrl && !isRentRoll && (
                        <embed
                          src={content.fileUrl}
                          type="application/pdf"
                          className="h-[50vh] min-h-[320px] w-full md:h-[440px]"
                        />
                      )}
                      {content.contentType === "LANDING_PAGE" && content.htmlContent && (
                        <div className="prose prose-sm max-w-none px-4 py-4">
                          <p className="whitespace-pre-wrap">{content.htmlContent}</p>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state — richer teaser or generic message */}
              {isExpanded && stageDocs.length === 0 && stageContent.length === 0 && (
                <div className="px-5 py-4 sm:px-6 sm:py-5">
                  {ss.stage.key === "teaser" ? (() => {
                    const teaserContent = contents.find(
                      (c: any) => c.stageKey === "teaser" && c.contentType === "LANDING_PAGE" && c.isPublished
                    );
                    const teaserImages: string[] = teaserContent?.imageUrls && Array.isArray(teaserContent.imageUrls)
                      ? teaserContent.imageUrls
                      : [];
                    const teaserMetrics: Record<string, string> = teaserContent?.keyMetrics && typeof teaserContent.keyMetrics === "object"
                      ? teaserContent.keyMetrics
                      : {};
                    // Stable ordering: standard 6 highlights first in canonical
                    // sequence (Office LFA → WALT/WALB), then any custom rows.
                    const metricEntries = orderedHighlightEntries(teaserMetrics);
                    return (
                      <div className="overflow-hidden rounded-lg border border-dils-200 bg-white">
                        {/* Hero image strip */}
                        {teaserImages.length > 0 ? (
                          <div className={cn(
                            "grid border-b border-dils-100",
                            teaserImages.length === 1 ? "grid-cols-1" :
                            teaserImages.length === 2 ? "grid-cols-2" :
                            "grid-cols-2 md:grid-cols-3"
                          )}>
                            {teaserImages.slice(0, 3).map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt={`Property image ${i + 1}`}
                                className={cn(
                                  "h-72 w-full object-cover md:h-96",
                                  i > 0 && "border-l border-dils-100"
                                )}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className={cn("flex h-72 items-center justify-center border-b border-dils-100 md:h-96", unit.tint)}>
                            <Building className="h-12 w-12 text-dils-black/40" strokeWidth={1.5} />
                          </div>
                        )}

                        <div className="p-5 sm:p-6 space-y-4">
                          <div>
                            <h4 className="font-heading text-lg font-semibold tracking-tight text-foreground">{tracking.asset.title}</h4>
                            <p className="mt-1 text-sm text-muted-foreground">{tracking.asset.address}, {tracking.asset.city}, {tracking.asset.country}</p>
                          </div>
                          {tracking.asset.assetType && (
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded border border-soft-office/30 bg-soft-office-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em] text-soft-office">
                                {tracking.asset.assetType}
                              </span>
                              {tracking.asset.transactionType && (
                                <span className="inline-flex items-center rounded border border-soft-retail/30 bg-soft-retail-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em] text-soft-retail">
                                  {tracking.asset.transactionType}
                                </span>
                              )}
                            </div>
                          )}
                          {teaserContent?.description && (
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{teaserContent.description}</p>
                          )}
                          {!teaserContent?.description && tracking.asset.description && (
                            <p className="text-sm text-muted-foreground">{tracking.asset.description}</p>
                          )}
                          {metricEntries.length > 0 && (
                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dils-100 md:grid-cols-3">
                              {metricEntries.map(({ key, label, value }) => (
                                <div key={key}>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">{label}</p>
                                  <p className="mt-1 font-heading text-base font-semibold text-foreground">{value}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground italic">
                            You have been invited to review this investment opportunity. Proceed to the NDA stage to access detailed materials.
                          </p>
                        </div>
                      </div>
                    );
                  })() : ss.stage.key === "viewing" ? (
                    /* Viewing stage: request flow.
                       - available (unlocked but not requested) → show request CTA
                       - action_needed (IN_PROGRESS, request sent) → show "awaiting" card
                       - completed → handled by stageDocs/stageContent path above */
                    state === "action_needed" ? (
                      <div className="rounded-md border-l-[3px] border-l-status-current bg-status-current/5 p-4">
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-status-current">
                          <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
                          Awaiting viewing date
                        </p>
                        <p className="mt-1 text-xs text-status-current/80">
                          The broker has been notified and will contact you to schedule a date.
                        </p>
                      </div>
                    ) : state === "available" ? (
                      <div className="rounded-lg border border-dils-200 bg-white p-5">
                        <h4 className="font-heading text-base font-semibold tracking-tight text-foreground">
                          Ready to view the property?
                        </h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Send the broker a request and they will reach out to schedule a viewing or
                          presentation at a time that suits you.
                        </p>
                        <Button
                          className="mt-4 bg-banner-info-foreground text-white hover:bg-banner-info-foreground/90"
                          disabled={requestingViewing}
                          onClick={handleRequestViewing}
                        >
                          <Calendar className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
                          {requestingViewing ? "Sending request…" : "Request viewing"}
                        </Button>
                        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Mail className="h-3 w-3" strokeWidth={2} />
                          Sends an email to the deal team
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        Complete the IM stage to request a viewing.
                      </p>
                    )
                  ) : state === "action_needed" ? (
                    <div className="rounded-md border-l-[3px] border-l-status-current bg-status-current/5 p-4">
                      <p className="text-sm font-semibold text-status-current">Waiting for documents</p>
                      <p className="mt-1 text-xs text-status-current/80">
                        The deal team is preparing the documents for this stage. You'll be able to proceed once they're ready.
                      </p>
                    </div>
                  ) : state === "pending_review" && ss.stage.key === "im" ? (
                    /* Specific copy for IM stage when NDA is signed but not
                       yet admin-approved. The default pending_review hint
                       talks about "your submission being reviewed" which
                       reads as if the IM itself is being reviewed, not the
                       NDA. Make it explicit so the investor doesn't think
                       the IM is auto-opened. */
                    <div className="rounded-md border-l-[3px] border-l-status-warning bg-status-warning-soft p-4">
                      <p className="text-sm font-semibold text-status-warning">Waiting for NDA approval</p>
                      <p className="mt-1 text-xs text-status-warning/80">
                        The deal team has received your signed NDA and is reviewing it. The
                        Information Memorandum will unlock here automatically once they approve.
                        We&rsquo;ll email you when that happens.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
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
