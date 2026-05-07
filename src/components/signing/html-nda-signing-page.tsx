"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signing/signature-pad";
import { signHtmlNda } from "@/actions/html-nda-actions";
import { uploadInvestorNda } from "@/actions/document-actions";
import { renderTemplate, injectSignature } from "@/lib/html-nda-template";
import type { TemplateField } from "@/lib/html-nda-template";
import { toast } from "sonner";
import { Building2, Check, FileText, Upload, Loader2 } from "lucide-react";

const INVESTOR_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  data: {
    documentId: string;
    assetTitle: string;
    companyName: string;
    html: string;
    fields: TemplateField[];
    adminFieldDefaults: Record<string, string>;
  };
  token: string;
}

export function HtmlNdaSigningPage({ data, token }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Auto-open the upload section when arriving from the journey card's
  // "Or upload pre-signed PDF" link (?upload=1).
  useEffect(() => {
    if (searchParams.get("upload") === "1") {
      setUploadOpen(true);
    }
  }, [searchParams]);

  function handleUploadFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setUploadFile(null);
      return;
    }
    if (file.type !== "application/pdf" && file.type !== "application/x-pdf") {
      toast.error("Only PDF files are allowed.");
      e.target.value = "";
      setUploadFile(null);
      return;
    }
    if (file.size > INVESTOR_UPLOAD_MAX_BYTES) {
      toast.error("File too large. Maximum size is 5MB.");
      e.target.value = "";
      setUploadFile(null);
      return;
    }
    setUploadFile(file);
  }

  async function handleUpload() {
    if (!uploadFile) return toast.error("Please choose a PDF to upload.");
    if (!name.trim()) return toast.error("Please enter your full name.");
    if (!email.trim()) return toast.error("Please enter your email address.");

    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", uploadFile);
      fd.set("token", token);
      fd.set("signedByName", name);
      fd.set("signedByEmail", email);
      await uploadInvestorNda(fd);
      setCompleted(true);
      toast.success("NDA uploaded — thanks!");
      setTimeout(() => router.push("/portal"), 1500);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload your NDA. Please try again or contact the deal team.");
    } finally {
      setUploading(false);
    }
  }

  // Investor-fillable fields = template fields not marked adminOnly and not
  // already present in adminFieldDefaults. NAME / FIRST_NAMES / SURNAME /
  // EMAIL are filled from the dedicated header inputs above the field list,
  // so we exclude them here to avoid asking for the same thing twice.
  const investorFields = useMemo(
    () =>
      data.fields.filter(
        (f) =>
          !f.adminOnly &&
          !data.adminFieldDefaults[f.key] &&
          f.key !== "NAME" &&
          f.key !== "FIRST_NAMES" &&
          f.key !== "SURNAME" &&
          f.key !== "EMAIL"
      ),
    [data.fields, data.adminFieldDefaults]
  );

  // Live preview: merge admin defaults + investor inputs + identity for render.
  const previewHtml = useMemo(() => {
    const merged: Record<string, string> = {
      ...values,
      ...data.adminFieldDefaults,
      DATE: new Date().toLocaleDateString("en-GB"),
      EMAIL: email,
    };
    if (name) {
      // Single full-name input drives three tokens. NAME = the whole
      // string (used in the signature line + by legacy templates).
      // FIRST_NAMES = everything except the last word, SURNAME = the last
      // word — Dutch templates render Voornamen / Achternaam separately
      // but we don't want to ask the signer twice. Imperfect for surnames
      // with particles ("de Vries"), but close enough; admin can override
      // by editing the rendered NDA before approval if needed.
      const trimmed = name.trim();
      const parts = trimmed.split(/\s+/);
      merged.NAME = trimmed;
      if (parts.length === 1) {
        merged.FIRST_NAMES = trimmed;
        merged.SURNAME = "";
      } else {
        merged.SURNAME = parts[parts.length - 1];
        merged.FIRST_NAMES = parts.slice(0, -1).join(" ");
      }
    }
    const html = renderTemplate(data.html, merged);
    return injectSignature(
      html,
      signature
        ? `<img src="${signature}" alt="signature" style="max-width:240px;max-height:90px;" />`
        : `<span style="color:#999;font-style:italic;">[ signature pending ]</span>`
    );
  }, [data.html, data.adminFieldDefaults, values, name, signature]);

  function setValue(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function canSubmit() {
    if (!name.trim() || !email.trim() || !signature) return false;
    for (const f of investorFields) {
      if (f.required !== false && !values[f.key]?.trim()) return false;
    }
    return true;
  }

  async function handleSubmit() {
    // Tell the investor exactly what's missing instead of a generic
    // "fill the fields" toast — they're already squinting at a long form.
    if (!name.trim()) return toast.error("Please enter your full name.");
    if (!email.trim()) return toast.error("Please enter your email address.");
    const missingField = investorFields.find(
      (f) => f.required !== false && !values[f.key]?.trim()
    );
    if (missingField) return toast.error(`"${missingField.label}" is required.`);
    if (!signature) return toast.error("Please draw your signature before submitting.");

    setSubmitting(true);
    try {
      await signHtmlNda({
        token,
        values,
        signatureData: signature,
        signedByName: name,
        signedByEmail: email,
      });
      setCompleted(true);
      toast.success("NDA signed — thanks!");
      setTimeout(() => router.push("/portal"), 1500);
    } catch (e: any) {
      // Surface the server's friendly error message verbatim (token-already-
      // used, etc.); only fall back to generic copy for unknown errors.
      toast.error(e?.message || "Couldn't submit the NDA. Please try again or contact the deal team.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Signed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Thanks. The signed NDA is on its way to your portal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-dils-100">
            <Building2 className="h-5 w-5 text-dils-700" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground sm:text-xs">
              Non-Disclosure Agreement
            </p>
            <h1 className="truncate text-sm font-semibold sm:text-base">{data.assetTitle}</h1>
          </div>
        </div>
      </header>

      {/*
        Mobile-first ordering:
          - Form gets `order-first` so an investor on a phone sees the inputs
            without scrolling past a 4-page NDA. On md+ the preview takes
            its natural left column.
          - md: instead of lg: lets tablets get the side-by-side too.
      */}
      <main className="mx-auto grid max-w-7xl gap-4 p-4 sm:gap-6 sm:p-6 md:grid-cols-[1fr_360px] lg:grid-cols-[1fr_380px]">
        {/* Live preview */}
        <section className="order-2 rounded-xl border bg-white p-5 shadow-sm sm:p-8 md:order-1">
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Live preview — fields fill in as you type</span>
          </div>
          <div
            className="prose prose-sm max-w-none text-[13px] leading-relaxed"
            // The template HTML is authored by the admin in our own UI, not
            // user-supplied — and field values are escaped at render time.
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </section>

        {/* Form */}
        <aside className="order-1 space-y-5 rounded-xl border bg-white p-5 shadow-sm sm:space-y-6 sm:p-6 md:order-2 md:sticky md:top-6 md:self-start">
          <div>
            <h2 className="text-sm font-semibold">Your details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These are also used as your signature identity.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="signer-name">Full name</Label>
                <Input
                  id="signer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="signer-email">Email</Label>
                <Input
                  id="signer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
              </div>
            </div>
          </div>

          {/* Document fields + signature pad belong to the in-portal sign
              flow only. Hidden when the investor opts to upload a pre-signed
              PDF instead, so the page doesn't ask for the same data twice
              and the disabled "Sign and submit" button doesn't make the
              page look stuck. */}
          {investorFields.length > 0 && !uploadOpen && (
            <div>
              <h2 className="text-sm font-semibold">Document fields</h2>
              <div className="mt-3 space-y-3">
                {investorFields.map((f) => {
                  const isRequired = f.required !== false;
                  // Select fields (e.g. CAPACITY) render a native <select>
                  // — Input alone can't enumerate the options.
                  if (f.type === "select" && f.options && f.options.length > 0) {
                    return (
                      <div key={f.key}>
                        <Label htmlFor={`f-${f.key}`}>
                          {f.label}
                          {isRequired && (
                            <span className="text-destructive" aria-hidden="true"> *</span>
                          )}
                        </Label>
                        <select
                          id={`f-${f.key}`}
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={values[f.key] ?? ""}
                          onChange={(e) => setValue(f.key, e.target.value)}
                          required={isRequired}
                          aria-required={isRequired}
                        >
                          <option value="" disabled>
                            Select…
                          </option>
                          {f.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div key={f.key}>
                      <Label htmlFor={`f-${f.key}`}>
                        {f.label}
                        {isRequired && (
                          <span className="text-destructive" aria-hidden="true"> *</span>
                        )}
                      </Label>
                      <Input
                        id={`f-${f.key}`}
                        type={f.type ?? "text"}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        placeholder={f.prefill ?? ""}
                        required={isRequired}
                        aria-required={isRequired}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!uploadOpen && (
            <>
              <div>
                <h2 className="text-sm font-semibold">Signature</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Draw with your mouse or finger. By signing you agree to the NDA above.
                </p>
                <div className="mt-3">
                  <SignaturePad onChange={setSignature} width={320} height={140} />
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!canSubmit() || submitting || uploading}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting…" : "Sign and submit"}
              </Button>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                By submitting, you confirm the values above are accurate and you have authority to bind {data.companyName}.
              </p>
            </>
          )}

          {/* Investor-uploaded NDA — alternative to the signature pad above.
              Same approval gate (admin still has to approve). The uploaded
              PDF replaces the HTML-rendered NDA as the signed copy. */}
          <div className="rounded-md border border-dashed bg-gray-50/60 p-3">
            {!uploadOpen ? (
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                disabled={submitting || uploading}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              >
                Or upload a pre-signed PDF instead
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Upload a pre-signed PDF</p>
                    <p className="text-[11px] text-muted-foreground">
                      PDF only · max 5 MB. The deal team will review and approve before granting IM access.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadOpen(false);
                      setUploadFile(null);
                      // Strip ?upload=1 so a refresh doesn't reopen the
                      // upload section.
                      if (searchParams.get("upload") === "1") {
                        router.replace(pathname);
                      }
                    }}
                    disabled={uploading}
                    className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={handleUploadFileChange}
                  disabled={uploading}
                  className="text-xs"
                />
                {uploadFile && (
                  <p className="text-[11px] text-muted-foreground">
                    {uploadFile.name} · {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleUpload}
                  disabled={
                    uploading ||
                    submitting ||
                    !uploadFile ||
                    !name.trim() ||
                    !email.trim()
                  }
                  className="w-full"
                >
                  {uploading ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Uploading...</>
                  ) : (
                    <><Upload className="mr-1.5 h-3.5 w-3.5" />Upload signed NDA</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
