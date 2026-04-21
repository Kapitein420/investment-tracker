"use client";

/**
 * PdfPlacementDialog — full-screen modal that fetches the document's
 * signed URL + existing placements and hosts the PdfPlacementEditor.
 * Handles the server-action round-trip on save.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import {
  getDocumentForPlacement,
  saveDocumentPlacements,
} from "@/actions/document-actions";
import type { FieldPlacement } from "@/lib/pdf-signing";
import { PdfPlacementEditor } from "./pdf-placement-editor";
import { toast } from "sonner";

interface PdfPlacementDialogProps {
  documentId: string;
  open: boolean;
  onClose: () => void;
}

export function PdfPlacementDialog({ documentId, open, onClose }: PdfPlacementDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    pdfUrl: string;
    fileName: string;
    placements: FieldPlacement[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getDocumentForPlacement(documentId);
        if (cancelled) return;
        if (!result.pdfUrl) {
          throw new Error("Could not load PDF file");
        }
        if (result.status === "SIGNED") {
          throw new Error("This document has already been signed");
        }
        setData({
          pdfUrl: result.pdfUrl,
          fileName: result.fileName,
          placements: result.placements,
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load document");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [documentId, open]);

  async function handleSave(placements: FieldPlacement[]) {
    await saveDocumentPlacements(documentId, placements);
    router.refresh();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div className="relative m-0 flex h-full w-full flex-col bg-white shadow-2xl sm:m-4 sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-dils-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-dils-black">Place signing fields</h2>
            <p className="text-[11px] text-dils-500">
              {data?.fileName ?? "Loading…"} — drag fields onto each page, then save.
            </p>
          </div>
          <button
            type="button"
            className="rounded-sm p-1 text-dils-500 hover:bg-dils-100 hover:text-dils-black"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-sm rounded-md border border-dils-red/40 bg-white p-4 text-center text-sm text-dils-red">
                {error}
              </div>
            </div>
          ) : loading || !data ? (
            <div className="flex h-full items-center justify-center gap-2 text-dils-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading document…</span>
            </div>
          ) : (
            <PdfPlacementEditor
              documentId={documentId}
              pdfUrl={data.pdfUrl}
              initialPlacements={data.placements}
              onSave={handleSave}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
