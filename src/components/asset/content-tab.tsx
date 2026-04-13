"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FileText, Upload, Download, Eye, Trash2, Plus, Check, Globe, X,
} from "lucide-react";
import { createAssetContent, updateAssetContent, deleteAssetContent, uploadContentFile } from "@/actions/content-actions";
import { getSignedDocumentUrl } from "@/actions/document-actions";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";

interface ContentTabProps {
  assetId: string;
  contents: any[];
  trackings: any[];
  editable: boolean;
}

export function ContentTab({ assetId, contents, trackings, editable }: ContentTabProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<"nda" | "im">("im");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Separate NDA and IM content
  const ndaContent = contents.find((c) => c.stageKey === "nda" && c.contentType === "PDF");
  const imContents = contents.filter((c) => c.stageKey === "im");

  // NDA signing stats from trackings
  const activeTrackings = trackings.filter((t: any) => t.lifecycleStatus !== "DROPPED");
  const ndaSignedCount = activeTrackings.filter((t: any) =>
    t.stageStatuses.some((ss: any) => ss.stage.key === "nda" && ss.status === "COMPLETED")
  ).length;

  async function handleUploadContent(stageKey: string, title: string) {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const fileUrl = await uploadContentFile(formData);

      await createAssetContent({
        assetId,
        stageKey,
        contentType: "PDF",
        title,
        fileUrl,
        fileName: file.name,
        isPublished: true,
      });

      toast.success(`${stageKey.toUpperCase()} document uploaded`);
      setAddDialogOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleViewPdf(fileUrl: string) {
    try {
      // If it's a storage path (not a full URL), get a signed URL
      if (!fileUrl.startsWith("http")) {
        const url = await getSignedDocumentUrl(fileUrl);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(fileUrl);
      }
    } catch {
      // Try using it directly
      setPreviewUrl(fileUrl);
    }
  }

  async function handleDownload(fileUrl: string, fileName: string) {
    try {
      let url = fileUrl;
      if (!fileUrl.startsWith("http")) {
        url = await getSignedDocumentUrl(fileUrl);
      }
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to get download link");
    }
  }

  async function handleTogglePublish(contentId: string, currentState: boolean) {
    try {
      await updateAssetContent(contentId, { isPublished: !currentState });
      toast.success(currentState ? "Unpublished" : "Published");
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleDelete(contentId: string) {
    try {
      await deleteAssetContent(contentId);
      toast.success("Content deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* NDA Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">NDA Document</h3>
            <p className="text-sm text-muted-foreground">
              Master NDA for this asset — sent to all invited companies
            </p>
          </div>
          {!ndaContent && editable && (
            <Button
              size="sm"
              onClick={() => { setAddType("nda"); setAddDialogOpen(true); }}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload NDA
            </Button>
          )}
        </div>

        {ndaContent ? (
          <div className="rounded-lg border bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100">
                  <FileText className="h-5 w-5 text-gold-600" />
                </div>
                <div>
                  <p className="font-medium">{ndaContent.fileName || ndaContent.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded {formatDate(ndaContent.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleViewPdf(ndaContent.fileUrl)}>
                  <Eye className="mr-1 h-3 w-3" />
                  View
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleDownload(ndaContent.fileUrl, ndaContent.fileName)}>
                  <Download className="mr-1 h-3 w-3" />
                  Download
                </Button>
                {editable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => { setAddType("nda"); setAddDialogOpen(true); }}
                  >
                    Replace
                  </Button>
                )}
              </div>
            </div>

            {/* Signing stats */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{ndaSignedCount}</p>
                  <p className="text-xs text-muted-foreground">Signed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{activeTrackings.length - ndaSignedCount}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{activeTrackings.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${activeTrackings.length > 0 ? (ndaSignedCount / activeTrackings.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-gray-50/50 p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No NDA uploaded yet</p>
            <p className="text-xs text-muted-foreground/60">Upload an NDA that all invited companies will need to sign</p>
          </div>
        )}
      </section>

      <Separator />

      {/* IM Materials Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">IM Materials</h3>
            <p className="text-sm text-muted-foreground">
              Information Memorandum — unlocks for investors after NDA approval
            </p>
          </div>
          {editable && (
            <Button
              size="sm"
              onClick={() => { setAddType("im"); setAddDialogOpen(true); }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Material
            </Button>
          )}
        </div>

        {imContents.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-gray-50/50 p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No IM materials yet</p>
            <p className="text-xs text-muted-foreground/60">Add PDFs or landing page content for approved investors</p>
          </div>
        ) : (
          <div className="space-y-3">
            {imContents.map((content: any) => (
              <div key={content.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {content.contentType === "PDF" ? (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{content.title}</p>
                      {content.description && (
                        <p className="text-xs text-muted-foreground">{content.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={content.isPublished ? "secondary" : "outline"} className="text-[10px]">
                          {content.isPublished ? "Published" : "Draft"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{formatDate(content.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {content.contentType === "PDF" && content.fileUrl && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewPdf(content.fileUrl)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(content.fileUrl, content.fileName)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {editable && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleTogglePublish(content.id, content.isPublished)}
                        >
                          {content.isPublished ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(content.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PDF Preview Modal */}
      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Document Preview</h3>
            </div>
            <embed
              src={previewUrl}
              type="application/pdf"
              className="w-full"
              style={{ height: "75vh" }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Upload Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {addType === "nda" ? "Upload NDA Document" : "Add IM Material"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>PDF File</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gold-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gold-700 hover:file:bg-gold-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => handleUploadContent(
                addType,
                addType === "nda" ? "NDA" : "Information Memorandum"
              )}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
