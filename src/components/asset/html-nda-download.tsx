"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { type TemplateField } from "@/lib/html-nda-template";
import { renderBlankNdaPreview, openNdaPrintWindow } from "@/lib/html-nda-print";

interface Props {
  htmlNda: any;
}

/**
 * Opens the asset's HTML NDA template in a new window with the same A4 print
 * CSS used on the investor-facing signed page, then triggers window.print()
 * so the browser's "Save as PDF" dialog produces a text-selectable copy.
 *
 * Admin defaults are substituted; investor-fillable fields render as a
 * literal `[Label]` placeholder — matching the on-screen preview.
 */
export function HtmlNdaDownload({ htmlNda }: Props) {
  const meta = (htmlNda?.keyMetrics as any) ?? {};
  const adminFieldDefaults: Record<string, string> = meta.adminFieldDefaults ?? {};
  const fields: TemplateField[] = meta.fields ?? [];
  const html: string = htmlNda?.htmlContent ?? "";

  const previewHtml = useMemo(
    () => renderBlankNdaPreview(html, fields, adminFieldDefaults),
    [html, adminFieldDefaults, fields],
  );

  function handleClick() {
    if (!openNdaPrintWindow(previewHtml)) {
      toast.error("Please allow pop-ups to download the NDA preview.");
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      onClick={handleClick}
    >
      <Download className="mr-1.5 h-3 w-3" />
      Download
    </Button>
  );
}
