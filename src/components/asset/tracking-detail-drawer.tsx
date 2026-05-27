"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type PipelineStage, type Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Send, ChevronRight, CheckCircle2, Clock, User, MessageSquare, History, FileText, ShieldCheck, Eye, Lock, Download, Upload, Pencil, Trash2, Undo2 } from "lucide-react";
import { DocumentUpload } from "@/components/asset/document-upload";
import { OfferSection } from "@/components/asset/offer-section";
import { approveStage } from "@/actions/approval-actions";
import { getSignedDocumentUrl } from "@/actions/document-actions";
import { cn, formatDateTime, formatDate } from "@/lib/utils";
import { canSeeContactDetails } from "@/lib/permissions";
import {
  STAGE_STATUS_LABELS,
  STAGE_DOT_COLORS,
  LIFECYCLE_LABELS,
  LIFECYCLE_COLORS,
  INTEREST_LABELS,
  INTEREST_COLORS,
} from "@/lib/stages";
import { getTrackingDetail, updateTracking, advanceToNextStage, finalizeTracking, revertToStage } from "@/actions/tracking-actions";
import { createComment, updateComment, deleteComment } from "@/actions/comment-actions";
import { toast } from "sonner";

interface TrackingDetailDrawerProps {
  trackingId: string;
  stages: PipelineStage[];
  users: Array<{ id: string; name: string }>;
  editable: boolean;
  currentUserId: string;
  userRole: Role;
  onClose: () => void;
}

export function TrackingDetailDrawer({
  trackingId,
  stages,
  users,
  editable,
  currentUserId,
  userRole,
  onClose,
}: TrackingDetailDrawerProps) {
  const showPII = canSeeContactDetails(userRole);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [revertOpen, setRevertOpen] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertTargetStageKey, setRevertTargetStageKey] = useState<string>("");

  async function loadDetail() {
    setLoading(true);
    try {
      const data = await getTrackingDetail(trackingId);
      setDetail(data);
    } catch {
      toast.error("Failed to load details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [trackingId]);

  async function handleComment() {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await createComment({ trackingId, body: commentText.trim() });
      setCommentText("");
      toast.success("Comment added");
      loadDetail();
      router.refresh();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditComment(c: { id: string; body: string }) {
    setEditingCommentId(c.id);
    setEditCommentText(c.body);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditCommentText("");
  }

  async function saveEditComment() {
    if (!editingCommentId || !editCommentText.trim()) return;
    setSubmitting(true);
    try {
      await updateComment(editingCommentId, editCommentText.trim());
      setEditingCommentId(null);
      setEditCommentText("");
      toast.success("Comment updated");
      loadDetail();
      router.refresh();
    } catch {
      toast.error("Failed to update comment");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteComment() {
    if (!deletingCommentId) return;
    setSubmitting(true);
    try {
      await deleteComment(deletingCommentId);
      setDeletingCommentId(null);
      toast.success("Comment deleted");
      loadDetail();
      router.refresh();
    } catch {
      toast.error("Failed to delete comment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLifecycleChange(value: string) {
    try {
      await updateTracking(trackingId, { lifecycleStatus: value as any });
      toast.success("Lifecycle updated");
      loadDetail();
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleOwnerChange(value: string) {
    try {
      await updateTracking(trackingId, { ownerUserId: value === "none" ? null : value });
      toast.success("Owner updated");
      loadDetail();
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  // Whether the tracking is currently sitting on its final stage IN_PROGRESS
  // (or the final stage is already completed but the lifecycle hasn't been
  // marked COMPLETED). In either case, the next admin action is to finalize
  // the deal — there are no more stages to advance to.
  function isOnFinalStage(): boolean {
    if (!detail?.stageStatuses?.length) return false;
    const sorted = [...detail.stageStatuses].sort(
      (a: any, b: any) => a.stage.sequence - b.stage.sequence
    );
    const lastIdx = sorted.length - 1;
    const last = sorted[lastIdx];
    if (last.status === "IN_PROGRESS") return true;
    if (last.status === "COMPLETED" && detail.lifecycleStatus !== "COMPLETED") return true;
    return false;
  }

  async function handleAdvance() {
    if (isOnFinalStage()) {
      // Open the finalize-deal confirmation modal instead of throwing.
      setFinalizeOpen(true);
      return;
    }
    try {
      await advanceToNextStage(trackingId);
      toast.success("Advanced to next stage");
      loadDetail();
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Cannot advance");
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await finalizeTracking(trackingId);
      toast.success("Deal finalized — marked Completed");
      setFinalizeOpen(false);
      loadDetail();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to finalize");
    } finally {
      setFinalizing(false);
    }
  }

  // Build the list of stages earlier than the tracking's current position.
  // "Current" here means the highest-sequence COMPLETED or IN_PROGRESS
  // stage — moving back to a stage equal or later than that would be a
  // no-op or a forward jump, neither of which belongs in this picker.
  function earlierStages(): Array<{ key: string; label: string; sequence: number }> {
    if (!detail?.stageStatuses?.length) return [];
    const sorted = [...detail.stageStatuses].sort(
      (a: any, b: any) => a.stage.sequence - b.stage.sequence,
    );
    const highestActive = [...sorted]
      .reverse()
      .find((s: any) => s.status === "COMPLETED" || s.status === "IN_PROGRESS");
    if (!highestActive) return [];
    return sorted
      .filter((s: any) => s.stage.sequence < highestActive.stage.sequence)
      .map((s: any) => ({
        key: s.stage.key,
        label: s.stage.label,
        sequence: s.stage.sequence,
      }));
  }

  function openRevertDialog() {
    const earlier = earlierStages();
    if (earlier.length === 0) {
      toast.error("No earlier stage to move back to");
      return;
    }
    // Default to the most-recent earlier stage so the common "undo one
    // step" case is a single click after opening.
    setRevertTargetStageKey(earlier[earlier.length - 1].key);
    setRevertOpen(true);
  }

  async function handleRevert() {
    if (!revertTargetStageKey) return;
    setReverting(true);
    try {
      const res = await revertToStage(trackingId, revertTargetStageKey);
      toast.success(`Moved back to ${res.target.label}`);
      setRevertOpen(false);
      loadDetail();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to move back");
    } finally {
      setReverting(false);
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-full max-w-[480px] flex-col border-l bg-white shadow-xl sm:w-[480px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">
            {loading ? "Loading..." : detail?.company?.name ?? "Details"}
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        ) : detail ? (
          <div className="flex-1 overflow-auto">
            {/* Meta section */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={cn("text-xs border-0", LIFECYCLE_COLORS[detail.lifecycleStatus as keyof typeof LIFECYCLE_COLORS])}>
                  {LIFECYCLE_LABELS[detail.lifecycleStatus as keyof typeof LIFECYCLE_LABELS]}
                </Badge>
                {detail.interestLevel && (
                  <Badge className={cn("text-xs border-0", INTEREST_COLORS[detail.interestLevel as keyof typeof INTEREST_COLORS])}>
                    {INTEREST_LABELS[detail.interestLevel as keyof typeof INTEREST_LABELS]}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {detail.relationshipType}
                </span>
              </div>

              {/* Stage progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Pipeline Progress</Label>
                  <div className="flex gap-1.5">
                    <Link href={`/assets/${detail.assetId}/timeline/${trackingId}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        Timeline
                      </Button>
                    </Link>
                    {/* Move back is ADMIN-only since it rewrites historical
                        state. Hidden when there's no earlier stage to revert
                        to (e.g. fresh tracking still on the first stage). */}
                    {editable && userRole === "ADMIN" && earlierStages().length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={openRevertDialog}
                        title="Move this investor back to an earlier pipeline stage"
                      >
                        <Undo2 className="mr-1 h-3 w-3" />
                        Move back
                      </Button>
                    )}
                    {editable && (
                      detail && isOnFinalStage() ? (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-status-success text-white hover:bg-status-success/90"
                          onClick={handleAdvance}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" strokeWidth={2.4} />
                          Finalize deal
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAdvance}>
                          <ChevronRight className="mr-1 h-3 w-3" />
                          Advance
                        </Button>
                      )
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {detail.stageStatuses
                    .sort((a: any, b: any) => a.stage.sequence - b.stage.sequence)
                    .map((ss: any) => {
                      const firstViewed = detail.firstAccessByStage?.[ss.stage.key];
                      return (
                        <div key={ss.id} className="flex-1 text-center">
                          <div
                            className={cn(
                              "h-2 rounded-full mb-1",
                              STAGE_DOT_COLORS[ss.status as keyof typeof STAGE_DOT_COLORS]
                            )}
                          />
                          <span className="text-[10px] text-muted-foreground">{ss.stage.label}</span>
                          {ss.completedAt && (
                            <span className="block text-[9px] text-muted-foreground/70">
                              {formatDate(ss.completedAt)}
                            </span>
                          )}
                          {ss.approvedAt && (
                            <span className="block text-[9px] text-emerald-600">Approved</span>
                          )}
                          {firstViewed && !ss.completedAt && (
                            <span
                              className="block text-[9px] text-dils-700"
                              title={`First opened ${formatDate(firstViewed)}`}
                            >
                              Viewed
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
                {detail.firstAccessByStage?.im && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    IM first opened {formatDate(detail.firstAccessByStage.im)}
                  </p>
                )}
              </div>

              {/* NDA Approval section */}
              {editable && detail.stageStatuses
                .filter((ss: any) => ss.status === "COMPLETED" && !ss.approvedAt && ss.stage.key === "nda")
                .map((ss: any) => {
                  // Most-recent SIGNED NDA doc on this tracking — that's the
                  // one the admin needs to download to vet before approving.
                  const ndaDoc = (detail.documents ?? []).find(
                    (d: any) => d.stage?.key === "nda" && d.status === "SIGNED"
                  );
                  const isInvestorUpload = ndaDoc?.signatureData === "INVESTOR_UPLOAD";
                  // HTML NDA without an investor-uploaded PDF override has no
                  // direct download — admin views it via the portal route.
                  const hasDownloadableFile =
                    ndaDoc &&
                    (ndaDoc.mimeType !== "text/html" ||
                      (ndaDoc.signedFileUrl && !ndaDoc.signedFileUrl.startsWith("html:")));

                  async function handleDownloadNda() {
                    if (!ndaDoc) return;
                    try {
                      const url = await getSignedDocumentUrl(ndaDoc.id);
                      window.open(url, "_blank");
                    } catch (e: any) {
                      toast.error(e?.message ?? "Failed to get download link");
                    }
                  }

                  return (
                  <div key={`approve-${ss.id}`} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-amber-800">NDA Signed — Awaiting Approval</p>
                          {ndaDoc && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold",
                                isInvestorUpload
                                  ? "border-amber-400 bg-amber-100 text-amber-800"
                                  : "border-amber-200 bg-white text-amber-700"
                              )}
                            >
                              {isInvestorUpload ? (
                                <><Upload className="mr-1 h-2.5 w-2.5" />Uploaded by investor</>
                              ) : (
                                "Signed via portal"
                              )}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-amber-600 mt-0.5">
                          {isInvestorUpload
                            ? "Review the uploaded PDF before approving — IM access unlocks on approval."
                            : "Approve to unlock IM access for this investor"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {hasDownloadableFile && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-amber-300 bg-white text-xs text-amber-800 hover:bg-amber-100"
                            onClick={handleDownloadNda}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Download
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs"
                          onClick={async () => {
                            // Approving an NDA fires a notification email AND
                            // unlocks IM access. Both are user-visible actions
                            // worth a confirmation step (consistent with the
                            // other invite/email guard rails added in PR #25).
                            const company = detail?.company?.name ?? "this investor";
                            const sourceNote = isInvestorUpload
                              ? "\n\n  ⚠ The NDA was UPLOADED by the investor — make sure you've reviewed the file."
                              : "";
                            if (
                              !confirm(
                                `Approve NDA for ${company}?\n\nThis will:\n  • Send an "NDA approved" email to the investor\n  • Unlock IM access for them${sourceNote}\n\nContinue?`
                              )
                            ) {
                              return;
                            }
                            try {
                              await approveStage(trackingId, "nda");
                              toast.success("NDA approved — IM access unlocked");
                              loadDetail();
                              router.refresh();
                            } catch {
                              toast.error("Failed to approve");
                            }
                          }}
                        >
                          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                          Approve NDA
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}

              {/* Editable fields */}
              {editable && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Lifecycle</Label>
                    <Select value={detail.lifecycleStatus} onValueChange={handleLifecycleChange}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(LIFECYCLE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Owner</Label>
                    <Select value={detail.ownerUserId ?? "none"} onValueChange={handleOwnerChange}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Company info */}
              <div className="rounded-md bg-gray-50 p-3 text-xs space-y-1">
                <p className="font-medium">{detail.company.name}</p>
                {detail.company.website && <p>Web: {detail.company.website}</p>}
                {showPII && (() => {
                  // Prefer the CompanyContact list (multi-contact, source of
                  // truth). Fall back to legacy contactName/contactEmail when
                  // no CompanyContacts have been recorded yet.
                  const contacts: Array<{ id: string; name: string | null; email: string }> =
                    detail.company.contacts ?? [];
                  if (contacts.length > 0) {
                    return (
                      <div className="pt-1">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Contacts ({contacts.length})
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {contacts.map((c) => (
                            <li key={c.id}>
                              {c.name ? `${c.name} — ` : ""}
                              <a
                                href={`mailto:${c.email}`}
                                className="text-dils-700 hover:underline"
                              >
                                {c.email}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  if (detail.company.contactName || detail.company.contactEmail) {
                    return (
                      <>
                        {detail.company.contactName && <p>Contact: {detail.company.contactName}</p>}
                        {detail.company.contactEmail && <p>Email: {detail.company.contactEmail}</p>}
                      </>
                    );
                  }
                  return null;
                })()}
                {!showPII && (
                  <p className="inline-flex items-center gap-1 pt-1 text-[11px] text-muted-foreground italic">
                    <Lock className="h-3 w-3" strokeWidth={2.2} />
                    Contact details visible to DILS team only
                  </p>
                )}
              </div>
              {/* NBO offer (bid amount + offer PDF). Visible to admins, the
                  selling-side VIEWER, and the INVESTOR themselves — the
                  parent page already gates which trackings a viewer/investor
                  can open. */}
              <OfferSection
                trackingId={trackingId}
                bidAmount={detail.bidAmount ?? null}
                bidCurrency={detail.bidCurrency ?? "EUR"}
                offerDocument={
                  (detail.documents ?? []).find((d: any) => d.kind === "OFFER")
                    ? {
                        id: (detail.documents ?? []).find((d: any) => d.kind === "OFFER")!.id,
                        fileName: (detail.documents ?? []).find((d: any) => d.kind === "OFFER")!.fileName,
                      }
                    : null
                }
                editable={editable}
                onChange={loadDetail}
              />
            </div>

            <Separator />

            {/* Tabs: Comments / History / Documents */}
            <Tabs defaultValue="comments" className="p-4">
              <TabsList className="w-full">
                <TabsTrigger value="comments" className="flex-1 text-xs">
                  <MessageSquare className="mr-1 h-3 w-3" />
                  Comments ({detail.comments?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex-1 text-xs">
                  <FileText className="mr-1 h-3 w-3" />
                  Docs ({detail.documents?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 text-xs">
                  <History className="mr-1 h-3 w-3" />
                  History ({detail.stageHistory?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comments" className="mt-3 space-y-3">
                {/* Add comment */}
                {editable && (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="min-h-[60px] text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleComment();
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-[60px] w-10 shrink-0"
                      onClick={handleComment}
                      disabled={submitting || !commentText.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Comment list */}
                {detail.comments?.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
                ) : (
                  <div className="space-y-2">
                    {detail.comments?.map((c: any) => {
                      const canModify =
                        editable && (c.author?.id === currentUserId || userRole === "ADMIN");
                      const isEditing = editingCommentId === c.id;
                      // updatedAt is bumped on every Comment.update; if it
                      // sits more than ~1s after createdAt we treat the row
                      // as edited. Sub-second drift between create and the
                      // initial updatedAt would otherwise show "(edited)"
                      // on brand-new comments.
                      const wasEdited =
                        new Date(c.updatedAt).getTime() -
                          new Date(c.createdAt).getTime() >
                        1000;
                      return (
                        <div key={c.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs font-medium">
                              {showPII ? c.author.name : "Team member"}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                {formatDateTime(c.createdAt)}
                                {wasEdited && (
                                  <span className="ml-1 italic">(edited)</span>
                                )}
                              </span>
                              {canModify && !isEditing && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => startEditComment(c)}
                                    title="Edit comment"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingCommentId(c.id)}
                                    title="Delete comment"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                className="min-h-[60px] text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                                    saveEditComment();
                                  if (e.key === "Escape") cancelEditComment();
                                }}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditComment}
                                  disabled={submitting}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={saveEditComment}
                                  disabled={submitting || !editCommentText.trim()}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">{c.body}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                {detail.stageHistory?.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No history yet</p>
                ) : (
                  <div className="space-y-2">
                    {detail.stageHistory?.map((h: any) => (
                      <div key={h.id} className="flex gap-2 text-xs border-l-2 border-gray-200 pl-3 py-1">
                        <div className="flex-1">
                          <p>
                            <span className="font-medium">{h.fieldName}</span>
                            {h.oldValue && (
                              <span className="text-muted-foreground"> from {h.oldValue}</span>
                            )}
                            <span className="text-muted-foreground"> to </span>
                            <span className="font-medium">{h.newValue}</span>
                          </p>
                          <p className="text-muted-foreground">
                            by {showPII ? h.changedBy.name : "Team member"} &middot; {formatDateTime(h.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-3">
                <DocumentUpload
                  trackingId={trackingId}
                  stages={stages}
                  documents={(detail.documents ?? []).filter(
                    (d: any) => d.kind !== "OFFER"
                  )}
                  editable={editable}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>

      {/* Finalize-deal confirmation dialog. Triggered when admin clicks
          "Finalize deal" on the final pipeline stage. Replaces the prior
          "Already at the final stage" error. */}
      <Dialog open={finalizeOpen} onOpenChange={(open) => { if (!finalizing) setFinalizeOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2 font-heading">
              <CheckCircle2 className="h-5 w-5 text-status-success" strokeWidth={2.4} />
              Finalize this deal?
            </DialogTitle>
            <DialogDescription>
              This marks the final pipeline stage as completed and moves the deal lifecycle
              to <strong>Completed</strong>. You can still view the timeline, comments, and
              documents — but the row will no longer appear under Active.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border-l-[3px] border-l-status-success bg-status-success-soft px-3.5 py-3 text-sm text-status-success">
            <strong className="font-semibold">{detail?.company?.name}</strong> · {detail?.asset?.title ?? "this asset"}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeOpen(false)} disabled={finalizing}>
              Cancel
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={finalizing}
              className="bg-status-success text-white hover:bg-status-success/90"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" strokeWidth={2.4} />
              {finalizing ? "Finalizing…" : "Yes, finalize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revertOpen}
        onOpenChange={(open) => {
          if (!reverting) setRevertOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2 font-heading">
              <Undo2 className="h-5 w-5 text-status-current" strokeWidth={2.4} />
              Move back to earlier stage
            </DialogTitle>
            <DialogDescription>
              Pick the stage you want this investor to land on. The target
              stage will be marked "action needed"; everything after it
              resets to "not started". Documents, signed NDAs, and prior
              approvals are kept — you won't need to re-approve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label className="text-xs text-muted-foreground">Move to</Label>
            <Select
              value={revertTargetStageKey}
              onValueChange={setRevertTargetStageKey}
              disabled={reverting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a stage" />
              </SelectTrigger>
              <SelectContent>
                {earlierStages().map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              The investor is not notified — this is an admin-side state
              correction.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevertOpen(false)}
              disabled={reverting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevert}
              disabled={reverting || !revertTargetStageKey}
            >
              <Undo2 className="mr-1.5 h-4 w-4" strokeWidth={2.4} />
              {reverting ? "Moving back…" : "Move back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingCommentId !== null}
        onOpenChange={(open) => {
          if (!submitting && !open) setDeletingCommentId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2 font-heading">
              <Trash2 className="h-5 w-5 text-destructive" strokeWidth={2.4} />
              Delete this comment?
            </DialogTitle>
            <DialogDescription>
              This permanently removes the comment from the timeline. This action can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingCommentId(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteComment}
              disabled={submitting}
            >
              <Trash2 className="mr-1.5 h-4 w-4" strokeWidth={2.4} />
              {submitting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
