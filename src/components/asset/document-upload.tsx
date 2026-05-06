"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Copy, Check, RefreshCw, ExternalLink, Settings2, MousePointer, Trash2, AlertTriangle, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { uploadDocument, deleteDocument, getSignedDocumentUrl } from "@/actions/document-actions";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PdfPlacementDialog } from "@/components/admin/pdf-placement-dialog";

const DOC_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-retail-soft text-status-warning",
  SIGNED: "bg-logistics-soft text-status-success",
  REJECTED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-muted text-muted-foreground",
};

interface DocumentUploadProps {
  trackingId: string;
  stages: Array<{ id: string; key: string; label: string }>;
  documents: Array<any>;
  editable: boolean;
}

export function DocumentUpload({ trackingId, stages, documents, editable }: DocumentUploadProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [uploadMode, setUploadMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [placementDocId, setPlacementDocId] = useState<string | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(doc: any, force = false) {
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id, { force });
      toast.success("Document deleted");
      setConfirmDeleteDoc(null);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }
  const [fieldConfig, setFieldConfig] = useState([
    { type: "signature" as const, page: -1, position: "bottom-center" },
    { type: "name" as const, page: -1, position: "bottom-left" },
    { type: "date" as const, page: -1, position: "bottom-right" },
  ]);

  const POSITIONS = [
    "top-left", "top-center", "top-right",
    "middle-left", "middle-center", "middle-right",
    "bottom-left", "bottom-center", "bottom-right",
  ];

  function updateField(idx: number, key: string, value: any) {
    setFieldConfig((prev) => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedStageId) {
      toast.error("Select a stage and choose a file");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("trackingId", trackingId);
      formData.append("stageId", selectedStageId);
      formData.append("fieldConfig", JSON.stringify(fieldConfig));
      if (uploadMode === "MANUAL") {
        formData.append("placementMode", "MANUAL");
      }

      const result = await uploadDocument(formData);
      if (result.placementMode === "MANUAL") {
        toast.success("Document uploaded — now place signing fields");
        // Open the placement editor for the freshly-uploaded doc
        setPlacementDocId(result.document.id);
      } else if (result.placementMode === "PLACEHOLDER") {
        toast.success(`Document uploaded with ${result.placeholderCount} placeholders detected`);
      } else {
        toast.success("Document uploaded (using position grid mode)");
      }

      // Copy signing link (unless MANUAL — then let admin place fields first)
      if (result.placementMode !== "MANUAL") {
        const baseUrl = window.location.origin;
        await navigator.clipboard.writeText(`${baseUrl}${result.signingUrl}`);
        toast.success("Signing link copied to clipboard");
      }

      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function copyLink(token: string, docId: string) {
    const baseUrl = window.location.origin;
    await navigator.clipboard.writeText(`${baseUrl}/sign/${token}`);
    setCopiedId(docId);
    toast.success("Signing link copied");
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      {editable && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div className="rounded-md bg-office-soft border border-office/30 p-3 text-xs text-banner-info-foreground">
            <p className="font-medium mb-1">Tip: Use placeholders for precise signing</p>
            <p>
              In your Word document, type <code className="bg-white px-1 rounded">{"{{SIGNATURE}}"}</code>,
              <code className="bg-white px-1 rounded ml-1">{"{{NAME}}"}</code>,
              <code className="bg-white px-1 rounded ml-1">{"{{DATE}}"}</code> where you want fields to appear.
              Export to PDF and upload &mdash; we&apos;ll detect them automatically.
            </p>
            <p className="mt-1">
              Or choose <span className="font-medium">Manual placement</span> below and drag-drop the
              signing fields after upload.
            </p>
          </div>
          <Label className="text-xs font-medium">Upload document for signing</Label>

          {/* Placement mode toggle */}
          <div className="flex items-center gap-2 rounded-md bg-muted p-1 text-[10px]">
            <button
              type="button"
              className={cn(
                "flex-1 rounded px-2 py-1 transition",
                uploadMode === "AUTO"
                  ? "bg-white font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setUploadMode("AUTO")}
            >
              Auto (placeholders / grid)
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded px-2 py-1 transition",
                uploadMode === "MANUAL"
                  ? "bg-white font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setUploadMode("MANUAL")}
            >
              Manual (drag-drop)
            </button>
          </div>

          <div className="flex gap-2">
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                id="doc-upload"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full text-xs"
                disabled={uploading || !selectedStageId}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3 w-3" />
                {uploading ? "Uploading..." : "Choose PDF"}
              </Button>
            </div>
          </div>

          {/* Field placement config */}
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setShowFieldConfig(!showFieldConfig)}
          >
            <Settings2 className="h-3 w-3" />
            {showFieldConfig ? "Hide" : "Configure"} signature field placement
          </button>

          {showFieldConfig && (
            <div className="space-y-2 rounded-md bg-muted p-2.5">
              {fieldConfig.map((field, idx) => (
                <div key={field.type} className="flex items-center gap-2">
                  <span className="w-16 text-[10px] font-medium capitalize">{field.type}</span>
                  <Select
                    value={field.position}
                    onValueChange={(v) => updateField(idx, "position", v)}
                  >
                    <SelectTrigger className="h-7 flex-1 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="h-7 w-16 text-[10px]"
                    value={field.page === -1 ? "" : field.page}
                    placeholder="Last"
                    onChange={(e) => updateField(idx, "page", e.target.value ? parseInt(e.target.value) : -1)}
                  />
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground">
                Page: leave empty for last page, or enter page number. Position: where on the page.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">No documents yet</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => {
            const activeToken = doc.signingTokens?.[0]?.token;
            return (
              <div key={doc.id} className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{doc.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {doc.stage.label} &middot; Uploaded {formatDate(doc.createdAt)} by {doc.uploadedBy.name}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] border-0", DOC_STATUS_COLORS[doc.status])}>
                    {doc.status}
                  </Badge>
                </div>

                {doc.status === "SIGNED" && (
                  <div className="rounded bg-logistics-soft px-2 py-1.5 text-xs text-status-success">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        Signed by {doc.signedByName} ({doc.signedByEmail}) on {formatDate(doc.signedAt)}
                        {doc.signatureData === "INVESTOR_UPLOAD" && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-amber-300 bg-amber-50 px-1 py-0 text-[9px] font-semibold text-amber-800"
                          >
                            <Upload className="mr-0.5 h-2 w-2" />Uploaded
                          </Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {/* HTML NDAs render server-side at /portal/signed-nda/[id]
                            unless the investor uploaded a real PDF (which flips
                            mimeType to application/pdf in uploadInvestorNda) —
                            in that case we fall through to the regular signed-
                            URL download. */}
                        {doc.mimeType === "text/html" ? (
                          <>
                            <a
                              href={`/portal/signed-nda/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                            <a
                              href={`/portal/signed-nda/${doc.id}?download=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-2"
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </a>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const url = await getSignedDocumentUrl(doc.id);
                                window.open(url, "_blank");
                              } catch (e: any) {
                                toast.error(e?.message ?? "Failed to get download link");
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-2"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {doc.status === "REJECTED" && doc.rejectionReason && (
                  <div className="rounded bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                    Declined: {doc.rejectionReason}
                  </div>
                )}

                {doc.status === "PENDING" && activeToken && editable && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] flex-1"
                      onClick={() => copyLink(activeToken, doc.id)}
                    >
                      {copiedId === doc.id ? (
                        <><Check className="mr-1 h-3 w-3" />Copied!</>
                      ) : (
                        <><Copy className="mr-1 h-3 w-3" />Copy signing link</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => setPlacementDocId(doc.id)}
                      title="Drag-drop signature/name/date fields onto the PDF"
                    >
                      <MousePointer className="mr-1 h-3 w-3" />
                      {doc.placementMode === "MANUAL" ? "Edit fields" : "Place fields"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => window.open(`/sign/${activeToken}`, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setConfirmDeleteDoc(doc)}
                      disabled={deletingId === doc.id}
                      title="Delete this document"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {doc.status === "SIGNED" && editable && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setConfirmDeleteDoc(doc)}
                      disabled={deletingId === doc.id}
                      title="Delete this signed document (legal record)"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={confirmDeleteDoc != null} onOpenChange={(o) => !o && setConfirmDeleteDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={2} />
              </div>
              <div>
                <DialogTitle>Delete document</DialogTitle>
                <DialogDescription>
                  {confirmDeleteDoc?.status === "SIGNED"
                    ? "This is a signed legal record. This cannot be undone."
                    : "This cannot be undone."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {confirmDeleteDoc && (
            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-foreground">{confirmDeleteDoc.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {confirmDeleteDoc.stage.label} · {confirmDeleteDoc.status}
                {confirmDeleteDoc.signedByName && (
                  <> · signed by {confirmDeleteDoc.signedByName}</>
                )}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteDoc(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmDeleteDoc &&
                handleDelete(confirmDeleteDoc, confirmDeleteDoc.status === "SIGNED")
              }
              disabled={deletingId != null}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deletingId ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual placement editor modal */}
      {placementDocId && (
        <PdfPlacementDialog
          documentId={placementDocId}
          open={true}
          onClose={() => setPlacementDocId(null)}
        />
      )}
    </div>
  );
}
