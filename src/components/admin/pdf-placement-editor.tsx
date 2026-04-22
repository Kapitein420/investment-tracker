"use client";

/**
 * PdfPlacementEditor — admin drag-drop UI for placing Signature/Name/Date
 * rectangles onto each page of a PDF. Stores coordinates as PDF points
 * (pdf-lib convention: origin bottom-left) so the existing `generateSignedPdf`
 * can consume them directly when Document.placementMode === "MANUAL".
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { FileSignature, Type, Calendar, Save, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FieldPlacement } from "@/lib/pdf-signing";

// Render scale (canvas px per PDF point). 1.5 is a good balance between
// clarity and memory on long documents.
const RENDER_SCALE = 1.5;

// Default sizes in PDF points
const DEFAULTS: Record<FieldPlacement["type"], { width: number; height: number }> = {
  signature: { width: 160, height: 40 },
  name: { width: 160, height: 20 },
  date: { width: 100, height: 20 },
};

type PageMeta = {
  /** 1-indexed page number */
  page: number;
  /** page width in PDF points */
  pdfWidth: number;
  /** page height in PDF points */
  pdfHeight: number;
};

/**
 * Draft placement used inside the editor. Coordinates are always present
 * (required), unlike `FieldPlacement` where they're optional for
 * backward-compat with legacy grid/position mode.
 */
type DraftPlacement = {
  _id: string;
  type: FieldPlacement["type"];
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

interface PdfPlacementEditorProps {
  documentId: string;
  pdfUrl: string;
  initialPlacements: FieldPlacement[];
  onSave: (placements: FieldPlacement[]) => Promise<void>;
  onClose?: () => void;
}

export function PdfPlacementEditor({
  documentId,
  pdfUrl,
  initialPlacements,
  onSave,
  onClose,
}: PdfPlacementEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [placements, setPlacements] = useState<DraftPlacement[]>(() =>
    initialPlacements
      // Keep only placements that already have explicit coords — the editor
      // cannot meaningfully display legacy named positions.
      .filter(
        (p) =>
          typeof p.x === "number" &&
          typeof p.y === "number" &&
          typeof p.width === "number" &&
          typeof p.height === "number"
      )
      .map((p, i) => ({
        _id: `init-${i}`,
        type: p.type,
        page: p.page > 0 ? p.page : 1,
        x: p.x as number,
        y: p.y as number,
        width: p.width as number,
        height: p.height as number,
      }))
  );
  const [saving, setSaving] = useState(false);
  const [activePage, setActivePage] = useState(1);

  const canvasRefs = useRef<Map<number, HTMLCanvasElement | null>>(new Map());
  const pageContainerRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  // ── Load + render the PDF into canvases ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      if (!pdfUrl) return;
      setLoading(true);
      setError(null);
      try {
        // @ts-ignore - pdfjs-dist types are finicky
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
          disableFontFace: true,
        } as any);
        const pdf = await loadingTask.promise;

        const meta: PageMeta[] = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const unscaled = page.getViewport({ scale: 1 });
          meta.push({
            page: pageNum,
            pdfWidth: unscaled.width,
            pdfHeight: unscaled.height,
          });
        }
        if (cancelled) return;
        setPages(meta);

        // Render each page to its canvas (after state update so refs exist)
        // We use requestAnimationFrame to wait for DOM.
        requestAnimationFrame(async () => {
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            if (cancelled) return;
            const canvas = canvasRefs.current.get(pageNum);
            if (!canvas) continue;
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: RENDER_SCALE });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            // pdfjs-dist v5 requires `canvas` param; older versions ignored it.
            await page.render({
              canvasContext: ctx,
              viewport,
              canvas,
            } as any).promise;
          }
          if (!cancelled) setLoading(false);
        });
      } catch (e: any) {
        console.error("[PdfPlacementEditor] Failed to render PDF:", e);
        if (!cancelled) {
          setError(e?.message ?? "Failed to render PDF");
          setLoading(false);
        }
      }
    }
    renderPdf();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // ── Add a placement ────────────────────────────────────────────────────
  const addPlacement = useCallback(
    (type: FieldPlacement["type"]) => {
      const currentPage = pages.find((p) => p.page === activePage);
      if (!currentPage) {
        toast.error("PDF not loaded yet");
        return;
      }
      const { width, height } = DEFAULTS[type];
      const x = Math.max(0, currentPage.pdfWidth / 2 - width / 2);
      const y = Math.max(0, currentPage.pdfHeight / 2 - height / 2);
      const newPlacement: DraftPlacement = {
        _id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        page: activePage,
        x,
        y,
        width,
        height,
      };
      setPlacements((prev) => [...prev, newPlacement]);
    },
    [activePage, pages]
  );

  const deletePlacement = useCallback((id: string) => {
    setPlacements((prev) => prev.filter((p) => p._id !== id));
  }, []);

  const updatePlacement = useCallback(
    (id: string, patch: Partial<DraftPlacement>) => {
      setPlacements((prev) =>
        prev.map((p) => (p._id === id ? { ...p, ...patch } : p))
      );
    },
    []
  );

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (placements.length === 0) {
      toast.error("Add at least one field before saving");
      return;
    }
    setSaving(true);
    try {
      // Strip client-only _id
      const clean: FieldPlacement[] = placements.map(({ _id: _omit, ...rest }) => rest);
      await onSave(clean);
      toast.success(`Saved ${clean.length} placement${clean.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save placements");
    } finally {
      setSaving(false);
    }
  }, [onSave, placements]);

  // ── Scroll detection for activePage (so "Add" targets the visible page) ─
  useEffect(() => {
    if (pages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the largest visible area
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }
        if (best && best.isIntersecting) {
          const el = best.target as HTMLElement;
          const pageNum = Number(el.dataset.page);
          if (pageNum) setActivePage(pageNum);
        }
      },
      { threshold: [0.1, 0.3, 0.6] }
    );
    pages.forEach((p) => {
      const el = pageContainerRefs.current.get(p.page);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [pages]);

  const placementsByPage = useMemo(() => {
    const map = new Map<number, DraftPlacement[]>();
    for (const p of placements) {
      const arr = map.get(p.page) ?? [];
      arr.push(p);
      map.set(p.page, arr);
    }
    return map;
  }, [placements]);

  return (
    <div className="flex h-full flex-col bg-muted">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <span className="rounded bg-muted px-2 py-1">
            Page {activePage}
            {pages.length > 0 ? ` / ${pages.length}` : ""}
          </span>
        </div>
        <div className="mx-2 h-5 w-px bg-border" />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => addPlacement("signature")}
          disabled={loading || !!error}
        >
          <FileSignature className="mr-1.5 h-3.5 w-3.5" />
          Add Signature
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => addPlacement("name")}
          disabled={loading || !!error}
        >
          <Type className="mr-1.5 h-3.5 w-3.5" />
          Add Name
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => addPlacement("date")}
          disabled={loading || !!error}
        >
          <Calendar className="mr-1.5 h-3.5 w-3.5" />
          Add Date
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {placements.length} placement{placements.length === 1 ? "" : "s"}
          </span>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={handleSave}
            disabled={saving || loading || !!error}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save placements
          </Button>
        </div>
      </div>

      {/* Pages */}
      <div className="flex-1 overflow-auto px-4 py-6">
        {error ? (
          <div className="mx-auto max-w-md rounded-md border border-destructive bg-white p-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Rendering PDF…</span>
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
            {pages.map((page) => (
              <PdfPage
                key={page.page}
                meta={page}
                canvasRef={(el) => canvasRefs.current.set(page.page, el)}
                containerRef={(el) => pageContainerRefs.current.set(page.page, el)}
                placements={placementsByPage.get(page.page) ?? []}
                onUpdate={updatePlacement}
                onDelete={deletePlacement}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single PDF page + overlay ─────────────────────────────────────────────
function PdfPage(props: {
  meta: PageMeta;
  canvasRef: (el: HTMLCanvasElement | null) => void;
  containerRef: (el: HTMLDivElement | null) => void;
  placements: DraftPlacement[];
  onUpdate: (id: string, patch: Partial<DraftPlacement>) => void;
  onDelete: (id: string) => void;
}) {
  const { meta, canvasRef, containerRef, placements, onUpdate, onDelete } = props;

  const canvasWidth = meta.pdfWidth * RENDER_SCALE;
  const canvasHeight = meta.pdfHeight * RENDER_SCALE;

  return (
    <div
      ref={containerRef}
      data-page={meta.page}
      className="relative shadow-md"
      style={{ width: canvasWidth, height: canvasHeight, maxWidth: "100%" }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full bg-white"
        style={{ width: canvasWidth, height: canvasHeight }}
      />
      {/* Absolute overlay in canvas pixel space */}
      <div
        className="absolute inset-0"
        style={{ width: canvasWidth, height: canvasHeight }}
      >
        {placements.map((p) => (
          <PlacementBox
            key={p._id}
            placement={p}
            pageMeta={meta}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute -top-5 left-0 text-[10px] font-medium text-muted-foreground">
        Page {meta.page}
      </div>
    </div>
  );
}

// ─── Draggable/resizable rectangle ─────────────────────────────────────────
const TYPE_LABELS: Record<FieldPlacement["type"], string> = {
  signature: "SIGNATURE",
  name: "NAME",
  date: "DATE",
};

function PlacementBox(props: {
  placement: DraftPlacement;
  pageMeta: PageMeta;
  onUpdate: (id: string, patch: Partial<DraftPlacement>) => void;
  onDelete: (id: string) => void;
}) {
  const { placement, pageMeta, onUpdate, onDelete } = props;

  // PDF points -> canvas pixels
  // PDF origin bottom-left; DOM origin top-left. So:
  //   leftPx  = x * scale
  //   topPx   = (pdfHeight - y - height) * scale
  const scale = RENDER_SCALE;
  const leftPx = placement.x * scale;
  const widthPx = placement.width * scale;
  const heightPx = placement.height * scale;
  const topPx = (pageMeta.pdfHeight - placement.y - placement.height) * scale;

  // ── Drag state kept in refs to avoid re-renders during move ────────────
  const dragState = useRef<{
    mode: "move" | "resize" | null;
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  }>({
    mode: null,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      mode,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: placement.x,
      startY: placement.y,
      startWidth: placement.width,
      startHeight: placement.height,
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (s.mode === null || s.pointerId !== e.pointerId) return;
    const dxPx = e.clientX - s.startClientX;
    const dyPx = e.clientY - s.startClientY;
    const dxPdf = dxPx / scale;
    const dyPdf = dyPx / scale;

    if (s.mode === "move") {
      // Moving in DOM coords: dy down -> PDF y decreases
      let newX = s.startX + dxPdf;
      let newY = s.startY - dyPdf;
      // Clamp inside page
      newX = Math.max(0, Math.min(newX, pageMeta.pdfWidth - placement.width));
      newY = Math.max(0, Math.min(newY, pageMeta.pdfHeight - placement.height));
      onUpdate(placement._id, { x: newX, y: newY });
    } else if (s.mode === "resize") {
      // Bottom-right handle: dx grows width, dy grows height (DOM down)
      // In PDF coords that means width += dxPdf, height += dyPdf, and because
      // PDF y is bottom-left, y (bottom) must decrease by dyPdf to keep top pinned.
      let newWidth = Math.max(20, s.startWidth + dxPdf);
      let newHeight = Math.max(12, s.startHeight + dyPdf);
      // Clamp so box stays on page
      newWidth = Math.min(newWidth, pageMeta.pdfWidth - s.startX);
      // Can't grow below y=0 (bottom edge). top = startY + startHeight (anchor).
      // New y = top - newHeight. Need newY >= 0 -> newHeight <= startY + startHeight.
      const maxHeight = s.startY + s.startHeight;
      newHeight = Math.min(newHeight, maxHeight);
      const newY = s.startY + s.startHeight - newHeight;
      onUpdate(placement._id, { width: newWidth, height: newHeight, y: newY });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (s.pointerId === e.pointerId) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      dragState.current = {
        ...s,
        mode: null,
        pointerId: null,
      };
    }
  };

  return (
    <div
      className={cn(
        "group absolute cursor-move select-none border border-primary bg-primary/5",
        "hover:bg-primary/10"
      )}
      style={{
        left: leftPx,
        top: topPx,
        width: widthPx,
        height: heightPx,
      }}
      onPointerDown={(e) => handlePointerDown(e, "move")}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Type badge top-left */}
      <span className="pointer-events-none absolute left-0 top-0 -translate-y-full rounded-t-sm bg-primary px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-primary-foreground">
        {TYPE_LABELS[placement.type]}
      </span>

      {/* Delete button top-right */}
      <button
        type="button"
        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-primary-foreground shadow hover:bg-destructive/90"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(placement._id);
        }}
        aria-label="Delete placement"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      {/* Resize handle bottom-right */}
      <div
        className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm bg-primary"
        onPointerDown={(e) => handlePointerDown(e, "resize")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Preview hint below the placement */}
      <span className="pointer-events-none absolute left-0 top-full mt-1 whitespace-nowrap rounded bg-white/90 px-1 text-[9px] text-muted-foreground shadow-sm">
        {previewHint(placement)}
      </span>
    </div>
  );
}

function previewHint(p: DraftPlacement): string {
  const wh = `${Math.round(p.width)} × ${Math.round(p.height)}pt`;
  switch (p.type) {
    case "signature":
      return `Signature image · ${wh}`;
    case "name":
      return `Signer name · ${wh}`;
    case "date":
      return `Signing date · ${wh}`;
  }
}
