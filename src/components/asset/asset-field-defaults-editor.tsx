"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAssetPlaceholderTokens,
  updateAssetFieldDefaults,
} from "@/actions/asset-actions";
import { rescanAssetPlaceholders } from "@/actions/document-actions";
import { humanizeToken } from "@/components/signing/dynamic-fields";
import { toast } from "sonner";
import { Save, RefreshCw, Sparkles } from "lucide-react";

/** System tokens are always auto-filled at signing time — not something
 *  admin should set defaults for. */
const SYSTEM_TOKENS = new Set(["NAME", "EMAIL", "DATE"]);

function isSystemToken(key: string): boolean {
  if (SYSTEM_TOKENS.has(key)) return true;
  if (key === "SIGNATURE") return true;
  if (key.startsWith("SIGNATURE_")) return true;
  return false;
}

interface Props {
  assetId: string;
  initialDefaults: Record<string, string>;
  editable: boolean;
}

export function AssetFieldDefaultsEditor({
  assetId,
  initialDefaults,
  editable,
}: Props) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>(initialDefaults);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const loadTokens = async (rescanFiles = false) => {
    setLoading(true);
    try {
      if (rescanFiles) {
        const r = await rescanAssetPlaceholders(assetId);
        if (r.scanned === 0) {
          toast.info("No PDFs to rescan");
        } else {
          toast.success(`Rescanned ${r.scanned} document${r.scanned === 1 ? "" : "s"}`);
        }
      }
      const keys = await getAssetPlaceholderTokens(assetId);
      const projectKeys = keys.filter((k) => !isSystemToken(k));
      setTokens(projectKeys);
    } catch {
      toast.error("Could not load placeholders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  // Include keys that only exist in saved defaults (e.g. stale) so they're
  // visible and editable / removable.
  const allKeys = useMemo(() => {
    const set = new Set<string>([...tokens, ...Object.keys(values)]);
    return Array.from(set)
      .filter((k) => !isSystemToken(k))
      .sort();
  }, [tokens, values]);

  function handleChange(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateAssetFieldDefaults(assetId, values);
        toast.success("Project fields saved");
      } catch (e: any) {
        toast.error(e.message || "Failed to save");
      }
    });
  }

  return (
    <div className="rounded-md border border-border bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-retail" strokeWidth={2} />
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Project fields
            </h3>
          </div>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Pre-fill project-level placeholders once (building name, vendor,
            city). Investors won't see these fields when they sign — the values
            below are applied automatically.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadTokens(true)}
          disabled={loading || pending}
          title="Re-download each PDF and re-run the placeholder scanner"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          Rescan
        </Button>
      </div>

      <div className="p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Scanning documents…</p>
        ) : allKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No placeholders detected yet. Upload a PDF that contains{" "}
            <code className="rounded bg-muted px-1 text-[11px]">{"{TOKEN}"}</code>{" "}
            or <code className="rounded bg-muted px-1 text-[11px]">{"{{TOKEN}}"}</code>{" "}
            tokens and come back here.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {allKeys.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`default-${key}`} className="flex items-center gap-2">
                  <span>{humanizeToken(key)}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] tracking-wider text-muted-foreground">
                    {`{{${key}}}`}
                  </code>
                </Label>
                <Input
                  id={`default-${key}`}
                  value={values[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder="Leave empty → investor fills it"
                  disabled={!editable || pending}
                />
              </div>
            ))}
          </div>
        )}

        {editable && allKeys.length > 0 && (
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <p className="text-[11px] text-muted-foreground">
              Empty fields are shown to the investor as inputs to fill in.
            </p>
            <Button onClick={handleSave} disabled={pending} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              {pending ? "Saving…" : "Save project fields"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
