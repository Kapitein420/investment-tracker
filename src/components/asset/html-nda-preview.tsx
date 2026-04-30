"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { renderTemplate, injectSignature, type TemplateField } from "@/lib/html-nda-template";

interface Props {
  htmlNda: any;
}

/**
 * Read-only preview of the asset's HTML NDA template — the admin sees
 * exactly what an investor will sign, with admin defaults already
 * substituted and all investor-fillable fields rendered as a literal
 * `[Field label]` placeholder so it's clear what the signer will fill.
 */
export function HtmlNdaPreview({ htmlNda }: Props) {
  const [open, setOpen] = useState(false);

  const meta = (htmlNda?.keyMetrics as any) ?? {};
  const adminFieldDefaults: Record<string, string> = meta.adminFieldDefaults ?? {};
  const fields: TemplateField[] = meta.fields ?? [];
  const html: string = htmlNda?.htmlContent ?? "";

  const previewHtml = useMemo(() => {
    // Build a values map: admin defaults first, then a placeholder
    // string for every other token so the preview reads like the real
    // doc but keeps the unfilled fields visually obvious.
    const merged: Record<string, string> = {
      ...adminFieldDefaults,
      DATE: "[date will be filled at signing]",
    };
    for (const f of fields) {
      if (merged[f.key]) continue;
      merged[f.key] = `[${f.label || f.key}]`;
    }
    // Derive helpers used by the Orizon template even if the field set
    // doesn't list them explicitly.
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

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <Eye className="mr-1.5 h-3 w-3" />
        View
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>NDA preview</DialogTitle>
            <p className="text-xs text-muted-foreground">
              How the NDA reads with the admin defaults substituted. Investor-fillable
              fields appear as <code className="rounded bg-muted px-1">[Label]</code>{" "}
              placeholders.
            </p>
          </DialogHeader>

          <div
            className="rounded-md border border-dils-100 bg-white p-6"
            // Template HTML is admin-authored and sanitised in the editor
            // before save (script / iframe / on-handlers stripped).
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
