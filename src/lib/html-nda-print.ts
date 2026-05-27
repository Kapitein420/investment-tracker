import {
  renderTemplate,
  injectSignature,
  type TemplateField,
} from "@/lib/html-nda-template";

/**
 * Substitute admin defaults into the template and replace every remaining
 * investor-fillable field with a `[Label]` placeholder so the printed PDF
 * shows the investor exactly which lines they need to complete by hand.
 * Shared by the admin's "Download" button on the asset edit page and the
 * investor's "Download" button on the deal-journey card — keeping the two
 * in lockstep so the file the investor receives matches what the admin
 * previewed.
 */
export function renderBlankNdaPreview(
  html: string,
  fields: TemplateField[],
  adminFieldDefaults: Record<string, string>,
): string {
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
    `<span style="display:inline-block;border-bottom:1px solid #000;min-width:200px;padding:0 4px;color:#888;font-style:italic;">[signature]</span>`,
  );
}

/**
 * Open a new browser window with the rendered preview wrapped in the
 * A4-print CSS used elsewhere on the platform, then trigger the print
 * dialog so the user gets a Save-as-PDF affordance.
 *
 * Returns true if the window opened, false if the browser blocked the
 * pop-up — the caller is responsible for surfacing the right toast so
 * the message can match the surrounding context (admin vs investor).
 */
export function openNdaPrintWindow(previewHtml: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;

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
  return true;
}
