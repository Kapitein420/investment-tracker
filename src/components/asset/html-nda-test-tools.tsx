"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { generateTestSigningLink, clearTestData } from "@/actions/html-nda-actions";
import { FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin-only QC panel: walk the real investor NDA signing flow against
 * throwaway test data, to catch render/hydration/template bugs before real
 * investors hit them. The data is isTest=true (filtered out of every real
 * pipeline/report) and removable with "Clear test data".
 *
 * Rendered only when the viewer is an ADMIN (gated in ContentTab); the server
 * actions also enforce requireRole("ADMIN").
 */
export function HtmlNdaTestTools({ assetId }: { assetId: string }) {
  const [busy, setBusy] = useState<"gen" | "clear" | null>(null);

  async function generate() {
    setBusy("gen");
    try {
      const { url } = await generateTestSigningLink(assetId);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard may be unavailable; the new tab still opens */
      }
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Test signing link opened in a new tab (and copied to clipboard).");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate test link");
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    if (!confirm("Delete all internal TEST signing data for this asset? Real investor data is untouched.")) {
      return;
    }
    setBusy("clear");
    try {
      const { deleted } = await clearTestData(assetId);
      toast.success(
        deleted > 0
          ? `Cleared ${deleted} test row${deleted === 1 ? "" : "s"}.`
          : "No test data to clear."
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to clear test data");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 border-dashed text-xs"
        onClick={generate}
        disabled={busy !== null}
        title="Admin only: open a throwaway investor signing link and walk the NDA flow to catch bugs. Creates isolated test data that's filtered out of all real reports."
      >
        <FlaskConical className="mr-1.5 h-3 w-3" />
        {busy === "gen" ? "Generating…" : "Test as investor"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-muted-foreground hover:text-destructive"
        onClick={clear}
        disabled={busy !== null}
        title="Delete all internal test signing data for this asset."
      >
        <Trash2 className="mr-1.5 h-3 w-3" />
        {busy === "clear" ? "Clearing…" : "Clear test data"}
      </Button>
    </>
  );
}
