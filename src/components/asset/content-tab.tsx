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
import { enableHtmlNdaForAsset, disableHtmlNdaForAsset, issueHtmlNdaToAllTrackings } from "@/actions/html-nda-actions";
import { HtmlNdaEditor } from "@/components/asset/html-nda-editor";
import { HtmlNdaPreview } from "@/components/asset/html-nda-preview";
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
  const htmlNda = contents.find(
    (c) =>
      c.stageKey === "nda" &&
      c.contentType === "LANDING_PAGE" &&
      (c.keyMetrics as any)?.isHtmlNda === true
  );
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
  // Standard key investment highlights — the six metrics every DILS deal
  // teaser should carry. Stored in keyMetrics as snake_case keys; everything
  // outside this list goes into the freeform "custom" section.
  const STANDARD_HIGHLIGHTS: Array<{ key: string; label: string; placeholder: string }> = [
    { key: "office_lfa", label: "Office LFA", placeholder: "2,500 m²" },
    { key: "construction_year", label: "Construction year", placeholder: "1998 (renovated 2019)" },
    { key: "epc_label", label: "EPC label", placeholder: "A++" },
    { key: "ownership", label: "Ownership", placeholder: "Freehold" },
    { key: "annual_rent_income", label: "Annual rent income", placeholder: "€1.2M" },
    { key: "walt_walb", label: "WALT / WALB", placeholder: "6.4 / 4.1 yrs" },
  ];
  const STANDARD_KEYS = new Set(STANDARD_HIGHLIGHTS.map((h) => h.key));

  const [teaserHighlights, setTeaserHighlights] = useState<Record<string, string>>(() =>
    Object.fromEntries(STANDARD_HIGHLIGHTS.map((h) => [h.key, ""]))
  );
  const [teaserCustomMetrics, setTeaserCustomMetrics] = useState<Array<{ key: string; value: string }>>([]);

  function openTeaserDialog() {
    const existingMetrics = (teaserContent?.keyMetrics as Record<string, string>) || {};
    setTeaserDescription(teaserContent?.description || "");
    setTeaserImageUrls(Array.isArray(teaserContent?.imageUrls) ? (teaserContent!.imageUrls as string[]) : []);

    // Backfill the new standard slots from the existing keyMetrics blob.
    // Old data with price/size/yield/notes survives as custom rows so the
    // admin can re-enter into the new fields if they want.
    setTeaserHighlights(
      Object.fromEntries(
        STANDARD_HIGHLIGHTS.map((h) => [h.key, existingMetrics[h.key] ?? ""])
      )
    );
    const custom = Object.entries(existingMetrics)
      .filter(([k]) => !STANDARD_KEYS.has(k))
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
      for (const h of STANDARD_HIGHLIGHTS) {
        const v = (teaserHighlights[h.key] ?? "").trim();
        if (v) metrics[h.key] = v;
      }
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

      // Master NDA is one-per-asset — replace in place instead of creating
      // a duplicate row that would be hidden behind the existing one.
      const existingMaster =
        stageKey === "nda" ? ndaContent : null;

      if (existingMaster) {
        await updateAssetContent(existingMaster.id, {
          fileUrl,
          fileName: file.name,
          title,
          isPublished: true,
        });
        toast.success(`${stageKey.toUpperCase()} document replaced`);
      } else {
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
      }

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
    <div className="max-w-3xl mx-auto space-y-9">
      {/* NDA Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">NDA Document</h2>
            <p className="text-sm text-muted-foreground mt-1">
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
          <div className="rounded-lg border border-dils-200 bg-white p-5 shadow-soft-card sm:p-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-dils-100">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-soft-marketing-soft text-soft-marketing">
                  <FileText className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{ndaContent.fileName || ndaContent.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Uploaded {formatDate(ndaContent.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
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
            <div className="mt-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="rounded-md bg-soft-bg-surface-alt p-3 text-center">
                  <p className="font-heading text-2xl font-semibold leading-none text-status-success tabular-nums">{ndaSignedCount}</p>
                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Signed</p>
                </div>
                <div className="rounded-md bg-soft-bg-surface-alt p-3 text-center">
                  <p className="font-heading text-2xl font-semibold leading-none text-foreground tabular-nums">{activeTrackings.length - ndaSignedCount}</p>
                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Pending</p>
                </div>
                <div className="rounded-md bg-soft-bg-surface-alt p-3 text-center">
                  <p className="font-heading text-2xl font-semibold leading-none text-foreground tabular-nums">{activeTrackings.length}</p>
                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Total</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-soft-bg-surface-alt overflow-hidden">
                <div
                  className="h-full rounded-full bg-status-success transition-all"
                  style={{ width: `${activeTrackings.length > 0 ? (ndaSignedCount / activeTrackings.length) * 100 : 0}%` }}
                />
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

        {/* HTML NDA flow — alternative to the PDF flow above. Skips pdfjs / scanner / placement entirely. */}
        <div className="mt-4 rounded-lg border border-banner-info-foreground/25 bg-gradient-to-b from-banner-info/35 to-white p-5 shadow-soft-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-banner-info-foreground" strokeWidth={2.4} />
                <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
                  HTML NDA <span className="ml-1 font-sans text-sm italic font-normal text-muted-foreground">(recommended)</span>
                </h3>
                {htmlNda && (
                  <Badge className="border-0 bg-status-success-soft text-status-success text-[11px] font-semibold">Active</Badge>
                )}
              </div>
              <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                Skip the PDF / scanner / placement flow. Investors fill the fields and sign in-browser; you get a signed HTML record.
              </p>
            </div>
            {editable && (
              htmlNda ? (
                <div className="flex items-center gap-2">
                  <HtmlNdaPreview htmlNda={htmlNda} />
                  <HtmlNdaEditor htmlNda={htmlNda} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={async () => {
                      try {
                        const r = await issueHtmlNdaToAllTrackings(assetId);
                        if (r.total === 0) {
                          toast.info("No investors yet on this asset.");
                        } else if (r.cloned > 0) {
                          toast.success(
                            `Issued NDA to ${r.cloned} investor${r.cloned === 1 ? "" : "s"}` +
                              (r.skipped > 0 ? ` (${r.skipped} already had it)` : "")
                          );
                        } else {
                          toast.info(`All ${r.total} investors already had this NDA.`);
                        }
                        router.refresh();
                      } catch (e: any) {
                        toast.error(e.message || "Failed to issue NDA");
                      }
                    }}
                    title="Clone the master template into every existing tracking — useful when investors were added before the NDA was set up."
                  >
                    Issue to all investors
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={async () => {
                      if (!confirm("Disable the HTML NDA flow for this asset? Existing signed copies stay.")) return;
                      try {
                        await disableHtmlNdaForAsset(assetId);
                        toast.success("HTML NDA disabled");
                        router.refresh();
                      } catch (e: any) {
                        toast.error(e.message || "Failed to disable");
                      }
                    }}
                  >
                    Disable
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={async () => {
                    try {
                      await enableHtmlNdaForAsset(assetId);
                      toast.success("HTML NDA enabled — invitees will sign the HTML version");
                      router.refresh();
                    } catch (e: any) {
                      toast.error(e.message || "Failed to enable");
                    }
                  }}
                >
                  Enable HTML NDA
                </Button>
              )
            )}
          </div>
          {htmlNda && (
            <div className="mt-3 rounded-md border-l-[3px] border-l-banner-info-foreground bg-banner-info px-3.5 py-2.5 text-[13px] font-medium text-banner-info-foreground">
              Default DILS NDA template is in use. New invitees automatically receive an HTML NDA link instead of a PDF.
            </div>
          )}
        </div>

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
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">Teaser Content</h2>
            <p className="text-sm text-muted-foreground mt-1">
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
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">IM Materials</h2>
            <p className="text-sm text-muted-foreground mt-1">
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
              <div key={content.id} className="flex items-center gap-3.5 rounded-md border border-dils-200 bg-white p-3.5 shadow-soft-card">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-soft-research-soft text-soft-research">
                  {content.contentType === "PDF" ? (
                    <FileText className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  ) : (
                    <Globe className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-banner-info-foreground text-sm truncate">{content.title}</p>
                  {content.description && (
                    <p className="text-xs text-muted-foreground truncate">{content.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[12px] text-muted-foreground">
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      content.isPublished ? "bg-status-success-soft text-status-success" : "bg-soft-bg-surface-alt text-muted-foreground"
                    )}>
                      {content.isPublished ? "Published" : "Draft"}
                    </span>
                    <span>·</span>
                    <span>{formatDate(content.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {content.contentType === "PDF" && content.fileUrl && (
                    <>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-dils-200" onClick={() => handleViewPdf(content.fileUrl)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-dils-200" onClick={() => handleDownload(content.fileUrl, content.fileName)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {editable && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-dils-200"
                        onClick={() => handleTogglePublish(content.id, content.isPublished)}
                      >
                        {content.isPublished ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-dils-200 hover:border-status-danger/40 hover:text-status-danger"
                        onClick={() => handleDelete(content.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
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

            {/* Key Investment Highlights */}
            <div className="space-y-3">
              <Label>Key Investment Highlights</Label>
              <div className="grid grid-cols-2 gap-3">
                {STANDARD_HIGHLIGHTS.map((h) => (
                  <div key={h.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{h.label}</Label>
                    <Input
                      value={teaserHighlights[h.key] ?? ""}
                      onChange={(e) =>
                        setTeaserHighlights((prev) => ({ ...prev, [h.key]: e.target.value }))
                      }
                      placeholder={h.placeholder}
                    />
                  </div>
                ))}
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
