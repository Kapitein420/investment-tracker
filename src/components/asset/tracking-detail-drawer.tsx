"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type PipelineStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Send, ChevronRight, Clock, User, MessageSquare, History, FileText, ShieldCheck } from "lucide-react";
import { DocumentUpload } from "@/components/asset/document-upload";
import { approveStage } from "@/actions/approval-actions";
import { cn, formatDateTime, formatDate } from "@/lib/utils";
import {
  STAGE_STATUS_LABELS,
  STAGE_DOT_COLORS,
  LIFECYCLE_LABELS,
  LIFECYCLE_COLORS,
  INTEREST_LABELS,
  INTEREST_COLORS,
} from "@/lib/stages";
import { getTrackingDetail, updateTracking, advanceToNextStage } from "@/actions/tracking-actions";
import { createComment } from "@/actions/comment-actions";
import { toast } from "sonner";

interface TrackingDetailDrawerProps {
  trackingId: string;
  stages: PipelineStage[];
  users: Array<{ id: string; name: string }>;
  editable: boolean;
  currentUserId: string;
  onClose: () => void;
}

export function TrackingDetailDrawer({
  trackingId,
  stages,
  users,
  editable,
  currentUserId,
  onClose,
}: TrackingDetailDrawerProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  async function handleAdvance() {
    try {
      await advanceToNextStage(trackingId);
      toast.success("Advanced to next stage");
      loadDetail();
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Cannot advance");
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
                    {editable && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAdvance}>
                        <ChevronRight className="mr-1 h-3 w-3" />
                        Advance
                      </Button>
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
                .map((ss: any) => (
                  <div key={`approve-${ss.id}`} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-amber-800">NDA Signed — Awaiting Approval</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Approve to unlock IM access for this investor
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs"
                        onClick={async () => {
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
                ))}

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
                {detail.company.contactName && <p>Contact: {detail.company.contactName}</p>}
                {detail.company.contactEmail && <p>Email: {detail.company.contactEmail}</p>}
                {detail.company.website && <p>Web: {detail.company.website}</p>}
              </div>
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
                    {detail.comments?.map((c: any) => (
                      <div key={c.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{c.author.name}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{c.body}</p>
                      </div>
                    ))}
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
                            by {h.changedBy.name} &middot; {formatDateTime(h.createdAt)}
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
                  documents={detail.documents ?? []}
                  editable={editable}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
    </div>
  );
}
