"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, AlertTriangle, Check } from "lucide-react";
import {
  bulkInviteInvestors,
  type BulkInviteResult,
  type BulkInviteRow,
} from "@/actions/bulk-invite-actions";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
}

export function BulkInviteDialog({ open, onOpenChange, assetId }: Props) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkInviteResult | null>(null);

  // Parse pasted CSV into preview rows. Header line is required so the
  // admin can use whichever column order they have. Strict on
  // `company_name` and `email`; `contact_name` is optional.
  const { rows, parseErrors } = useMemo(() => {
    if (!csvText.trim()) return { rows: [] as BulkInviteRow[], parseErrors: [] as string[] };
    return parseCsv(csvText);
  }, [csvText]);

  async function handleSubmit() {
    if (rows.length === 0) {
      toast.error("Add at least one row.");
      return;
    }
    if (parseErrors.length > 0) {
      toast.error(`Fix ${parseErrors.length} parse error${parseErrors.length === 1 ? "" : "s"} first.`);
      return;
    }
    // Final-check gate: spell out exactly how many emails are about to fire
    // and to whom. The CSV preview is informational; this confirm is the
    // explicit "send" approval. Lists up to 5 recipients so the admin sees
    // the actual addresses before clicking OK.
    const sample = rows.slice(0, 5).map((r) => `  • ${r.companyName} <${r.email}>`).join("\n");
    const more = rows.length > 5 ? `\n  …and ${rows.length - 5} more` : "";
    const ok = confirm(
      `About to send ${rows.length} invitation email${rows.length === 1 ? "" : "s"}.\n\n${sample}${more}\n\nThis cannot be undone — accounts and password emails will be created/sent immediately. Continue?`
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      const r = await bulkInviteInvestors({ assetId, rows });
      setResult(r);
      const noun = r.totalRows === 1 ? "row" : "rows";
      if (r.failed === 0 && r.emailsFailed === 0) {
        toast.success(`Imported ${r.succeeded} ${noun} — all emails sent.`);
      } else {
        toast.warning(
          `Imported ${r.succeeded}/${r.totalRows} ${noun}. ${r.failed} failed, ${r.emailsFailed} email${r.emailsFailed === 1 ? "" : "s"} didn't send. See per-row results below.`,
          { duration: 12000 }
        );
      }
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Bulk import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setCsvText("");
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk invite investors</DialogTitle>
          <DialogDescription>
            Paste a CSV with header <code className="rounded bg-muted px-1">company_name,contact_name,email</code> (header order can vary). Up to 50 rows per batch.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-csv">CSV</Label>
              <Textarea
                id="bulk-csv"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`company_name,contact_name,email\nUptown,Anna van der Meer,anna@uptown.nl\nDRC,Daan Reijnders,daan@drc.nl`}
                className="mt-1 min-h-[200px] font-mono text-[12px]"
                disabled={submitting}
              />
            </div>

            {csvText.trim() && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {rows.length} valid row{rows.length === 1 ? "" : "s"}
                  </span>
                  {parseErrors.length > 0 && (
                    <span className="text-destructive">
                      {parseErrors.length} parse error{parseErrors.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                {parseErrors.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-destructive">
                    {parseErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>… {parseErrors.length - 5} more</li>
                    )}
                  </ul>
                )}
                {rows.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Existing companies will be reused (matched on email or name). Existing investors with login activity keep their password.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Total" value={result.totalRows} />
              <Stat label="Succeeded" value={result.succeeded} tone={result.failed === 0 ? "good" : undefined} />
              <Stat label="Emails sent" value={result.emailsSent} tone={result.emailsSent === result.totalRows ? "good" : undefined} />
              <Stat label="Failed" value={result.failed + result.emailsFailed} tone={result.failed + result.emailsFailed > 0 ? "bad" : "good"} />
            </div>

            <div className="max-h-[320px] overflow-auto rounded-md border">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Row</th>
                    <th className="px-2 py-1.5 text-left">Email</th>
                    <th className="px-2 py-1.5 text-left">Status</th>
                    <th className="px-2 py-1.5 text-left">Email</th>
                    <th className="px-2 py-1.5 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.row} className="border-t">
                      <td className="px-2 py-1.5 text-muted-foreground">{r.row}</td>
                      <td className="px-2 py-1.5 font-mono">{r.email}</td>
                      <td className="px-2 py-1.5">
                        {r.status === "invited" && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                            <Check className="mr-1 h-3 w-3" />
                            Invited
                          </Badge>
                        )}
                        {r.status === "reinvited" && (
                          <Badge className="bg-dils-100 text-dils-700 border-0 text-[10px]">
                            Re-invited
                          </Badge>
                        )}
                        {r.status === "error" && (
                          <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Error
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.status !== "error" &&
                          (r.emailSent ? (
                            <span className="text-emerald-700">Sent</span>
                          ) : (
                            <span className="text-red-600">Failed</span>
                          ))}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {r.status === "error"
                          ? r.message
                          : r.emailError ?? (r.status === "invited" ? r.companyName : `Re-invite to ${r.companyName}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Generated passwords are visible to admins via Supabase{" "}
              <code className="rounded bg-muted px-1">User</code> table query (or a Supabase SQL
              export). Investors received them in the invite email above.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleSubmit} disabled={submitting || rows.length === 0 || parseErrors.length > 0}>
              <Upload className="mr-1.5 h-4 w-4" />
              {submitting ? `Inviting ${rows.length}…` : `Invite ${rows.length || ""} ${rows.length === 1 ? "investor" : "investors"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border bg-white p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          tone === "good"
            ? "mt-0.5 text-lg font-semibold text-emerald-700"
            : tone === "bad"
              ? "mt-0.5 text-lg font-semibold text-red-600"
              : "mt-0.5 text-lg font-semibold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Minimal CSV parser. Splits on newlines + commas. Expects header row.
 * Rejects formula-injection patterns ("=cmd|...", "@SUM(...)").
 * Accepts column orders: company_name, contact_name (optional), email.
 */
function parseCsv(text: string): {
  rows: BulkInviteRow[];
  parseErrors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], parseErrors: [] };

  const errors: string[] = [];
  const header = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const colCompany = findColumn(header, ["company_name", "company", "name"]);
  const colEmail = findColumn(header, ["email", "contact_email", "e-mail"]);
  const colContact = findColumn(header, ["contact_name", "contact", "first_name"]);

  if (colCompany === -1) errors.push("Header row must include a 'company_name' (or 'company') column.");
  if (colEmail === -1) errors.push("Header row must include an 'email' column.");
  if (errors.length > 0) return { rows: [], parseErrors: errors };

  const rows: BulkInviteRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const companyName = cells[colCompany] ?? "";
    const email = cells[colEmail] ?? "";
    const contactName = colContact >= 0 ? (cells[colContact] ?? "") : "";

    // Block CSV formula injection — these get evaluated if the file is opened in Excel.
    for (const cell of [companyName, email, contactName]) {
      if (/^[=+@\-%]/.test(cell)) {
        errors.push(`Row ${i + 1}: cell starts with a formula character (=, +, @, -, %) — refusing to import.`);
        break;
      }
    }
    if (errors.length && errors[errors.length - 1].startsWith(`Row ${i + 1}`)) continue;

    if (!companyName) {
      errors.push(`Row ${i + 1}: missing company_name.`);
      continue;
    }
    if (!email) {
      errors.push(`Row ${i + 1}: missing email.`);
      continue;
    }

    rows.push({ companyName, contactName: contactName || undefined, email });
  }

  return { rows, parseErrors: errors };
}

function findColumn(header: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = header.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}
