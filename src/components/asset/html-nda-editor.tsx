"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { updateHtmlNdaTemplate } from "@/actions/html-nda-actions";
import { extractTokens, type TemplateField } from "@/lib/html-nda-template";
import { Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  htmlNda: any;
}

export function HtmlNdaEditor({ htmlNda }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const meta = (htmlNda?.keyMetrics as any) ?? {};
  const initialFields: TemplateField[] = meta.fields ?? [];
  const initialDefaults: Record<string, string> = meta.adminFieldDefaults ?? {};

  const [html, setHtml] = useState<string>(htmlNda?.htmlContent ?? "");
  const [defaults, setDefaults] = useState<Record<string, string>>(initialDefaults);
  const [fields, setFields] = useState<TemplateField[]>(initialFields);
  const [saving, setSaving] = useState(false);

  // Tokens that the current HTML actually references — keeps the form
  // honest if the admin renames something inside the template body.
  const referencedTokens = extractTokens(html).filter((t) => t !== "SIGNATURE_BLOCK" && t !== "DATE");
  const fieldsByKey = new Map(fields.map((f) => [f.key, f]));
  const allKeys = Array.from(new Set([...referencedTokens, ...fields.map((f) => f.key)])).sort();

  function setDefault(key: string, val: string) {
    setDefaults((d) => ({ ...d, [key]: val }));
  }

  function toggleAdminOnly(key: string, on: boolean) {
    setFields((fs) => {
      const i = fs.findIndex((f) => f.key === key);
      if (i === -1) return [...fs, { key, label: humanize(key), adminOnly: on }];
      const next = [...fs];
      next[i] = { ...next[i], adminOnly: on };
      return next;
    });
  }

  function setLabel(key: string, label: string) {
    setFields((fs) => {
      const i = fs.findIndex((f) => f.key === key);
      if (i === -1) return [...fs, { key, label }];
      const next = [...fs];
      next[i] = { ...next[i], label };
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Drop empty defaults so the investor can fill them instead.
      const cleanDefaults: Record<string, string> = {};
      for (const [k, v] of Object.entries(defaults)) {
        if (v && v.trim()) cleanDefaults[k] = v.trim();
      }
      // Sync field set with what the HTML actually references.
      const syncedFields: TemplateField[] = allKeys.map((k) => {
        const existing = fieldsByKey.get(k);
        return existing ?? { key: k, label: humanize(k) };
      });

      await updateHtmlNdaTemplate(htmlNda.id, {
        html,
        adminFieldDefaults: cleanDefaults,
        fields: syncedFields,
      });
      toast.success("Template saved");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function resetState() {
    setHtml(htmlNda?.htmlContent ?? "");
    setDefaults(initialDefaults);
    setFields(initialFields);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => {
          resetState();
          setOpen(true);
        }}
      >
        <Pencil className="mr-1.5 h-3 w-3" />
        Edit template
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetState();
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit HTML NDA template</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
            <section className="space-y-2">
              <Label htmlFor="nda-html">HTML body</Label>
              <p className="text-[11px] text-muted-foreground">
                Use{" "}
                <code className="rounded bg-muted px-1">{"{{TOKEN}}"}</code> for any field — they'll appear on the right.
                Reserved tokens: <code className="rounded bg-muted px-1">{"{{SIGNATURE_BLOCK}}"}</code>,{" "}
                <code className="rounded bg-muted px-1">{"{{DATE}}"}</code> auto-fill at sign time.
              </p>
              <Textarea
                id="nda-html"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className="min-h-[400px] font-mono text-[12px]"
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-dils-brass" />
                <h3 className="text-sm font-semibold">Fields ({allKeys.length})</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pre-fill values you control once (BUILDING_NAME, CITY). Mark as
                "Admin only" to hide from the investor form.
              </p>

              <div className="space-y-3">
                {allKeys.map((k) => {
                  const f = fieldsByKey.get(k);
                  const isAdminOnly = f?.adminOnly ?? false;
                  return (
                    <div key={k} className="rounded-md border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <code className="rounded bg-white px-1.5 py-0.5 text-[11px] tracking-wider">{`{{${k}}}`}</code>
                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isAdminOnly}
                            onChange={(e) => toggleAdminOnly(k, e.target.checked)}
                          />
                          Admin only
                        </label>
                      </div>
                      <Input
                        placeholder="Label (e.g. 'Building name')"
                        value={f?.label ?? humanize(k)}
                        onChange={(e) => setLabel(k, e.target.value)}
                        className="h-7 text-xs"
                      />
                      <Input
                        placeholder={isAdminOnly ? "Required value" : "Optional pre-fill"}
                        value={defaults[k] ?? ""}
                        onChange={(e) => setDefault(k, e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function humanize(key: string) {
  return key
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
