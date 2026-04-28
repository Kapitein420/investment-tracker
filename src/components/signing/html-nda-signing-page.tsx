"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signing/signature-pad";
import { signHtmlNda } from "@/actions/html-nda-actions";
import { renderTemplate, injectSignature } from "@/lib/html-nda-template";
import type { TemplateField } from "@/lib/html-nda-template";
import { toast } from "sonner";
import { Building2, Check, FileText } from "lucide-react";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Investor-fillable fields = template fields not marked adminOnly and not
  // already present in adminFieldDefaults.
  const investorFields = useMemo(
    () =>
      data.fields.filter(
        (f) => !f.adminOnly && !data.adminFieldDefaults[f.key]
      ),
    [data.fields, data.adminFieldDefaults]
  );

  // Live preview: merge admin defaults + investor inputs + identity for render.
  const previewHtml = useMemo(() => {
    const merged: Record<string, string> = {
      ...values,
      ...data.adminFieldDefaults,
      DATE: new Date().toLocaleDateString("en-GB"),
    };
    if (name) {
      const parts = name.trim().split(/\s+/);
      merged.NAME = parts[0] ?? "";
      merged.SURNAME = parts.slice(1).join(" ");
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
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-dils-100">
            <Building2 className="h-5 w-5 text-dils-700" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Non-Disclosure Agreement
            </p>
            <h1 className="text-base font-semibold">{data.assetTitle}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[1fr_380px]">
        {/* Live preview */}
        <section className="rounded-xl border bg-white p-8 shadow-sm">
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
        <aside className="space-y-6 rounded-xl border bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:self-start">
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

          {investorFields.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold">Document fields</h2>
              <div className="mt-3 space-y-3">
                {investorFields.map((f) => {
                  const isRequired = f.required !== false;
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
            disabled={!canSubmit() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting…" : "Sign and submit"}
          </Button>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            By submitting, you confirm the values above are accurate and you have authority to bind {data.companyName}.
          </p>
        </aside>
      </main>
    </div>
  );
}
