"use client";

import { useState, useRef, useEffect } from "react";
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
  FileText, Upload, Download, Eye, Trash2, Plus, Check, Globe, X, Image as ImageIcon, Pencil,
} from "lucide-react";
import { createAssetContent, updateAssetContent, deleteAssetContent, uploadContentFile, getSignedContentUrl, upsertTeaserContent } from "@/actions/content-actions";
import { deleteAssetPendingDocuments } from "@/actions/document-actions";
import { AssetFieldDefaultsEditor } from "@/components/asset/asset-field-defaults-editor";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";

interface ContentTabProps {
  assetId: string;
  contents: any[];
  trackings: any[];
  editable: boolean;
  assetFieldDefaults?: Record<string, string>;
}

export function ContentTab({ assetId, contents, trackings, editable, assetFieldDefaults }: ContentTabProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<"nda" | "im">("im");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Separate NDA, Teaser, and IM content
  const ndaContent = contents.find((c) => c.stageKey === "nda" && c.contentType === "PDF");
  const teaserContent = contents.find((c) => c.stageKey === "teaser" && c.contentType === "LANDING_PAGE");
  const imContents = contents.filter((c) => c.stageKey === "im");

  // Teaser editor state
  const teaserImageInputRef = useRef<HTMLInputElement>(null);
  const [teaserDialogOpen, setTeaserDialogOpen] = useState(false);
  const [teaserSaving, setTeaserSaving] = useState(false);
  const [teaserImageUploading, setTeaserImageUploading] = useState(false);
  const [teaserDescription, setTeaserDescription] = useState<string>("");
  const [teaserImageUrls, setTeaserImageUrls] = useState<string[]>([]);
  const [teaserImageSigned, setTeaserImageSigned] = useState<Record<string, string>>({});
  const [teaserMetrics, setTeaserMetrics] = useState<{ price: string; size: string; yield: string; notes: string }>({
    price: "", size: "", yield: "", notes: "",
  });
  const [teaserCustomMetrics, setTeaserCustomMetrics] = useState<Array<{ key: string; value: string }>>([]);

  function openTeaserDialog() {
    const existingMetrics = (teaserContent?.keyMetrics as Record<string, string>) || {};
    setTeaserDescription(teaserContent?.description || "");
    setTeaserImageUrls(Array.isArray(teaserContent?.imageUrls) ? (teaserContent!.imageUrls as string[]) : []);
    setTeaserMetrics({
      price: existingMetrics.price || "",
      size: existingMetrics.size || "",
      yield: existingMetrics.yield || "",
      notes: existingMetrics.notes || "",
    });
    const reserved = new Set(["price", "size", "yield", "notes"]);
    const custom = Object.entries(existingMetrics)
      .filter(([k]) => !reserved.has(k))
      .map(([key, value]) => ({ key, value: String(value) }));
    setTeaserCustomMetrics(custom);
    setTeaserDialogOpen(true);
  }

  async function resolveTeaserImageSigned(path: string) {
    if (!path || path.startsWith("http") || teaserImageSigned[path]) return;
    try {
      const url = await getSignedContentUrl(path);
      setTeaserImageSigned((prev) => ({ ...prev, [path]: url }));
    } catch {
      /* ignore */
    }
  }

  async function handleTeaserImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remaining = 5 - teaserImageUrls.length;
    if (remaining <= 0) {
      toast.error("Max 5 images");
      return;
    }
    setTeaserImageUploading(true);
    try {
      const toUpload = Array.from(files).slice(0, remaining);
      const paths: string[] = [];
      for (const file of toUpload) {
        const fd = new FormData();
        fd.append("file", file);
        const path = await uploadContentFile(fd);
        paths.push(path);
      }
      setTeaserImageUrls((prev) => [...prev, ...paths]);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setTeaserImageUploading(false);
      if (teaserImageInputRef.current) teaserImageInputRef.current.value = "";
    }
  }

  function removeTeaserImage(idx: number) {
    setTeaserImageUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveTeaser() {
    setTeaserSaving(true);
    try {
      const metrics: Record<string, string> = {};
      if (teaserMetrics.price) metrics.price = teaserMetrics.price;
      if (teaserMetrics.size) metrics.size = teaserMetrics.size;
      if (teaserMetrics.yield) metrics.yield = teaserMetrics.yield;
      if (teaserMetrics.notes) metrics.notes = teaserMetrics.notes;
      for (const { key, value } of teaserCustomMetrics) {
        if (key.trim() && value.trim()) metrics[key.trim()] = value.trim();
      }
      await upsertTeaserContent({
        assetId,
        description: teaserDescription,
        imageUrls: teaserImageUrls,
        keyMetrics: metrics,
      });
      toast.success("Teaser content saved");
      setTeaserDialogOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setTeaserSaving(false);
    }
  }

  // NDA signing stats from trackings
  const activeTrackings = trackings.filter((t: any) => t.lifecycleStatus !== "DROPPED");
  const ndaSignedCount = activeTrackings.filter((t: any) =>
    t.stageStatuses.some((ss: any) => ss.stage.key === "nda" && ss.status === "COMPLETED")
  ).length;

  // Resolve signed URLs for any teaser images (preview thumbnails + dialog)
  useEffect(() => {
    const paths = new Set<string>();
    if (Array.isArray(teaserContent?.imageUrls)) {
      for (const p of teaserContent!.imageUrls as string[]) {
        if (typeof p === "string" && !p.startsWith("http")) paths.add(p);
      }
    }
    for (const p of teaserImageUrls) {
      if (typeof p === "string" && !p.startsWith("http")) paths.add(p);
    }
    Array.from(paths).forEach((p) => {
      if (!teaserImageSigned[p]) resolveTeaserImageSigned(p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teaserContent, teaserImageUrls]);

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
      const url = await getSignedContentUrl(fileUrl);
      setPreviewUrl(url);
    } catch {
      toast.error("Failed to load document preview");
    }
  }

  async function handleDownload(fileUrl: string, fileName: string) {
    try {
      const url = await getSignedContentUrl(fileUrl);
      // Trigger actual download
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Failed to download document");
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
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted border border-border">
                  <FileText className="h-5 w-5 text-foreground" strokeWidth={2} />
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
                  <p className="text-2xl font-bold text-status-success">{ndaSignedCount}</p>
                  <p className="text-xs text-muted-foreground">Signed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-status-warning">{activeTrackings.length - ndaSignedCount}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{activeTrackings.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-status-success transition-all"
                      style={{ width: `${activeTrackings.length > 0 ? (ndaSignedCount / activeTrackings.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              {editable && activeTrackings.length - ndaSignedCount > 0 && (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={async () => {
                      if (!confirm("Delete every PENDING signing document for this asset? Signed documents stay.")) return;
                      try {
                        const r = await deleteAssetPendingDocuments(assetId);
                        if (r.deleted === 0) {
                          toast.info("No pending documents to delete");
                        } else {
                          toast.success(`Deleted ${r.deleted} pending document${r.deleted === 1 ? "" : "s"}`);
                        }
                        router.refresh();
                      } catch (e: any) {
                        toast.error(e.message || "Cleanup failed");
                      }
                    }}
                    title="Delete every PENDING signing doc for this asset (signed docs stay)"
                  >
                    Clean up pending
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/50 p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No NDA uploaded yet</p>
            <p className="text-xs text-muted-foreground/60">Upload an NDA that all invited companies will need to sign</p>
          </div>
        )}

        {/* Project-level placeholder defaults */}
        <div className="mt-4">
          <AssetFieldDefaultsEditor
            assetId={assetId}
            initialDefaults={assetFieldDefaults ?? {}}
            editable={editable}
          />
        </div>
      </section>

      <Separator />

      {/* Teaser Content Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Teaser Content</h3>
            <p className="text-sm text-muted-foreground">
              Property overview shown to investors before NDA — description, images, and key metrics
            </p>
          </div>
          {editable && (
            <Button size="sm" onClick={openTeaserDialog}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {teaserContent ? "Edit Teaser" : "Add Teaser"}
            </Button>
          )}
        </div>

        {teaserContent ? (
          <div className="rounded-lg border bg-white p-5 space-y-4">
            {Array.isArray(teaserContent.imageUrls) && (teaserContent.imageUrls as string[]).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(teaserContent.imageUrls as string[]).map((path, i) => {
                  const src = path.startsWith("http") ? path : teaserImageSigned[path];
                  return (
                    <div key={i} className="h-20 w-20 rounded-md border overflow-hidden bg-muted">
                      {src ? (
                        <img src={src} alt={`Teaser ${i + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {teaserContent.description && (
              <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{teaserContent.description}</p>
            )}

            {teaserContent.keyMetrics && typeof teaserContent.keyMetrics === "object" && (
              <div className="flex flex-wrap gap-4 pt-3 border-t">
                {Object.entries(teaserContent.keyMetrics as Record<string, any>)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                      <p className="text-sm font-semibold">{String(v)}</p>
                    </div>
                  ))}
              </div>
            )}

            {!teaserContent.description
              && (!Array.isArray(teaserContent.imageUrls) || (teaserContent.imageUrls as string[]).length === 0)
              && (!teaserContent.keyMetrics || Object.keys(teaserContent.keyMetrics as object).length === 0) && (
                <p className="text-sm text-muted-foreground italic">Teaser exists but is empty. Click Edit to add content.</p>
              )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/50 p-8 text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No teaser content yet</p>
            <p className="text-xs text-muted-foreground/60">Add a description, images, and key metrics to attract investors</p>
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
          <div className="rounded-lg border border-dashed bg-muted/50 p-8 text-center">
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

      {/* Teaser Edit Dialog */}
      <Dialog open={teaserDialogOpen} onOpenChange={setTeaserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{teaserContent ? "Edit Teaser" : "Add Teaser Content"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={teaserDescription}
                onChange={(e) => setTeaserDescription(e.target.value)}
                placeholder="Describe the investment opportunity..."
                rows={6}
              />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>Images ({teaserImageUrls.length}/5)</Label>
              <div className="flex flex-wrap gap-2">
                {teaserImageUrls.map((path, i) => {
                  const src = path.startsWith("http") ? path : teaserImageSigned[path];
                  return (
                    <div key={i} className="relative h-[100px] w-[100px] rounded-md border overflow-hidden bg-muted">
                      {src ? (
                        <img src={src} alt={`Image ${i + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeTeaserImage(i)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-primary-foreground flex items-center justify-center hover:bg-black/80"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {teaserImageUrls.length < 5 && (
                  <label className="h-[100px] w-[100px] rounded-md border border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {teaserImageUploading ? "Uploading..." : "Add image"}
                    </span>
                    <input
                      ref={teaserImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleTeaserImageUpload}
                      disabled={teaserImageUploading}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="space-y-3">
              <Label>Key Metrics</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Price</Label>
                  <Input
                    value={teaserMetrics.price}
                    onChange={(e) => setTeaserMetrics((m) => ({ ...m, price: e.target.value }))}
                    placeholder="€5M"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Size</Label>
                  <Input
                    value={teaserMetrics.size}
                    onChange={(e) => setTeaserMetrics((m) => ({ ...m, size: e.target.value }))}
                    placeholder="2,500 m²"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Yield</Label>
                  <Input
                    value={teaserMetrics.yield}
                    onChange={(e) => setTeaserMetrics((m) => ({ ...m, yield: e.target.value }))}
                    placeholder="5.8%"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Input
                    value={teaserMetrics.notes}
                    onChange={(e) => setTeaserMetrics((m) => ({ ...m, notes: e.target.value }))}
                    placeholder="Prime location"
                  />
                </div>
              </div>

              {/* Custom metrics */}
              {teaserCustomMetrics.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Custom Metrics</Label>
                  {teaserCustomMetrics.map((m, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={m.key}
                        onChange={(e) => setTeaserCustomMetrics((prev) => prev.map((x, i) => i === idx ? { ...x, key: e.target.value } : x))}
                        placeholder="Metric name"
                        className="flex-1"
                      />
                      <Input
                        value={m.value}
                        onChange={(e) => setTeaserCustomMetrics((prev) => prev.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))}
                        placeholder="Value"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setTeaserCustomMetrics((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTeaserCustomMetrics((prev) => [...prev, { key: "", value: "" }])}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add custom metric
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeaserDialogOpen(false)} disabled={teaserSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveTeaser} disabled={teaserSaving || teaserImageUploading}>
              {teaserSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
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
