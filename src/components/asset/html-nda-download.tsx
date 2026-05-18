"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { renderTemplate, injectSignature, type TemplateField } from "@/lib/html-nda-template";

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

  const previewHtml = useMemo(() => {
    const merged: Record<string, string> = {
      ...adminFieldDefaults,
      DATE: "[date will be filled at signing]",
    };
    for (const f of fields) {
      if (merged[f.key]) continue;
      merged[f.key] = `[${f.label || f.key}]`;
    }
    if (!merged.NAME) merged.NAME = "[Full name]";
    if (!merged.FIRST_NAMES) merged.FIRST_NAMES = "[Volledige voornamen]";
    if (!merged.SURNAME) merged.SURNAME = "[Achternaam]";
    if (!merged.EMAIL) merged.EMAIL = "[Email]";

    const rendered = renderTemplate(html, merged);
    return injectSignature(
      rendered,
      `<span style="display:inline-block;border-bottom:1px solid #000;min-width:200px;padding:0 4px;color:#888;font-style:italic;">[signature]</span>`
    );
  }, [html, adminFieldDefaults, fields]);

  function handleClick() {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Please allow pop-ups to download the NDA preview.");
      return;
    }

    const doc = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<title>NDA preview</title>
<style>
  html, body { background: white; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #111827;
  }
  .nda-print-surface {
    max-width: 178mm;
    margin: 12mm auto;
    padding: 0 4mm;
    font-size: 13px;
    line-height: 1.55;
  }
  .nda-print-surface h1,
  .nda-print-surface h2,
  .nda-print-surface h3 { font-family: ui-serif, Georgia, "Times New Roman", serif; }
  .nda-print-surface p,
  .nda-print-surface li,
  .nda-print-surface h1,
  .nda-print-surface h2,
  .nda-print-surface h3 { break-inside: avoid; page-break-inside: avoid; }
  /* Strip the field underline so placeholder labels read cleanly */
  .nda-print-surface .nda-doc .field,
  .nda-print-surface .nda-doc .field-inline {
    border-bottom: 0 !important;
    padding-bottom: 0 !important;
    min-width: 0 !important;
  }
  @media print {
    @page { size: A4; margin: 16mm; }
    body { background: white !important; }
    .nda-print-surface { margin: 0; padding: 0; max-width: none; }
  }
</style>
</head>
<body>
  <div class="nda-print-surface">${previewHtml}</div>
  <script>
    window.addEventListener("load", function () {
      // Tick lets the browser lay out before the print dialog grabs the page.
      setTimeout(function () { window.print(); }, 150);
    });
  </script>
</body>
</html>`;

    w.document.open();
    w.document.write(doc);
    w.document.close();
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
