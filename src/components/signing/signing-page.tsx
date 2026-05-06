"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/signing/signature-pad";
import { DynamicFieldInputs, extractCustomFields } from "@/components/signing/dynamic-fields";
import { FileText, Check, X, AlertTriangle, Download, Upload, Loader2 } from "lucide-react";
import { signDocument, rejectDocument, uploadInvestorNda, getSignedDocumentUrl } from "@/actions/document-actions";
import { toast } from "sonner";

const INVESTOR_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

interface SigningPageProps {
  document: {
    id: string;
    fileName: string;
    fileUrl: string;
    status: string;
    stage: { label: string };
    placementMode?: string | null;
    placeholderMap?: unknown;
    assetFieldDefaults?: Record<string, string>;
    tracking: {
      company: { name: string };
      asset: { title: string };
    };
  };
  token: string;
}

export function SigningPage({ document: doc, token }: SigningPageProps) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"sign" | "reject" | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<"signed" | "rejected" | null>(null);

  const assetDefaults = useMemo<Record<string, string>>(
    () =>
      ((doc as unknown as { assetFieldDefaults?: Record<string, string> })
        .assetFieldDefaults ?? {}),
    [doc]
  );
  const customFieldKeys = useMemo(() => {
    if (doc.placementMode !== "PLACEHOLDER") return [];
    const all = extractCustomFields(
      (doc.placeholderMap ?? null) as Record<string, unknown> | null
    );
    // Hide tokens the admin has already filled in at asset level
    return all.filter((k) => !(k in assetDefaults));
  }, [doc.placementMode, doc.placeholderMap, assetDefaults]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const allCustomFieldsFilled = customFieldKeys.every(
    (k) => (fieldValues[k] ?? "").trim().length > 0
  );

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
    if (!signerName) return toast.error("Please enter your full name.");
    if (!signerEmail) return toast.error("Please enter your email address.");

    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", uploadFile);
      fd.set("token", token);
      fd.set("signedByName", signerName);
      fd.set("signedByEmail", signerEmail);
      await uploadInvestorNda(fd);
      setCompleted("signed");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload your NDA. Please try again or contact the deal team.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSign() {
    if (!signerName) return toast.error("Please enter your full name.");
    if (!signerEmail) return toast.error("Please enter your email address.");
    if (!signatureData) return toast.error("Please draw your signature before submitting.");
    if (!allCustomFieldsFilled) return toast.error("Please fill in every document field marked required.");

    setSubmitting(true);
    try {
      await signDocument({
        token,
        signedByName: signerName,
        signedByEmail: signerEmail,
        signatureData,
        fieldValues,
      });
      setCompleted("signed");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't submit the signature. Please try again or contact the deal team.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      await rejectDocument({ token, rejectionReason: rejectionReason || undefined });
      setCompleted("rejected");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Completed state
  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            completed === "signed" ? "bg-emerald-100" : "bg-red-100"
          }`}>
            {completed === "signed" ? (
              <Check className="h-7 w-7 text-emerald-600" />
            ) : (
              <X className="h-7 w-7 text-red-600" />
            )}
          </div>
          <h2 className="mt-4 text-xl font-semibold">
            {completed === "signed" ? "Document Signed" : "Document Declined"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {completed === "signed"
              ? "Your signature has been recorded. The requesting party has been notified."
              : "Your response has been recorded. The requesting party has been notified."}
          </p>
          {completed === "signed" && signatureData && (
            <div className="mt-4 inline-block rounded-lg border bg-gray-50 p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Your signature</p>
              <img src={signatureData} alt="Signature" className="h-10 opacity-80" />
            </div>
          )}

          <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-muted-foreground">
            <p>{doc.tracking.asset.title}</p>
            <p>{doc.tracking.company.name} &middot; {doc.stage.label}</p>
            <p>{doc.fileName}</p>
          </div>

          {completed === "signed" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={async () => {
                try {
                  const url = await getSignedDocumentUrl(doc.id);
                  window.open(url, "_blank");
                } catch {
                  // Fallback: use the fileUrl directly
                  window.open(doc.fileUrl, "_blank");
                }
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download Document
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dils-50/60">
      {/* Header */}
      <div className="border-b border-dils-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex flex-col leading-none gap-1.5">
              <Image
                src="/dils-logo.png"
                alt="DILS"
                width={88}
                height={28}
                priority
                className="h-7 w-auto object-contain sm:h-8"
              />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Document Signing</span>
            </div>
            <div className="h-10 w-px bg-dils-200" />
            <div className="min-w-0">
              <h1 className="font-heading text-base font-semibold sm:text-lg">Sign your NDA</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {doc.tracking.asset.title} &middot; {doc.tracking.company.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-4 space-y-6 sm:p-6">
        {/* Document info */}
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{doc.fileName}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">{doc.stage.label}</Badge>
                <span>Please review and sign this document below</span>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="rounded-lg border bg-white overflow-hidden">
          <embed
            src={doc.fileUrl}
            type="application/pdf"
            className="h-[50vh] min-h-[300px] w-full md:h-[500px]"
          />
          <div className="border-t bg-gray-50 px-4 py-2 text-center">
            <button
              type="button"
              onClick={() => window.open(doc.fileUrl, "_blank")}
              className="text-xs text-dils-black underline hover:text-dils-red"
            >
              Open PDF in a new tab
            </button>
          </div>
        </div>

        {/* Signing form */}
        {mode !== "reject" && (
          <div className="rounded-lg border bg-white p-6 space-y-4">
            <h2 className="font-semibold">Sign this document</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Your full name</Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Your email</Label>
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Signing date</Label>
                <Input value={new Date().toLocaleDateString("en-GB")} disabled className="bg-gray-50" />
              </div>
            </div>

            {customFieldKeys.length > 0 && (
              <div className="space-y-3 rounded-md border border-dils-200 bg-dils-50/40 p-4">
                <div>
                  <p className="font-heading text-sm font-semibold text-dils-black">Document fields</p>
                  <p className="text-xs text-muted-foreground">
                    These values replace the <code className="text-[10px]">{"{{...}}"}</code> placeholders in the document.
                  </p>
                </div>
                <DynamicFieldInputs
                  fieldKeys={customFieldKeys}
                  values={fieldValues}
                  onChange={setFieldValues}
                  disabled={submitting}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Your signature</Label>
              <SignaturePad onChange={setSignatureData} />
            </div>

            <div className="rounded-md bg-gray-50 border p-3 text-[11px] text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Data Privacy Notice</p>
              <p>
                By signing this document, you acknowledge that your name, email, signature image,
                and signing timestamp will be stored by DILS Group B.V. as part of this deal process.
                This data is used solely for contract execution and legal compliance under GDPR.
              </p>
              <p>
                You have the right to access, rectify, or request deletion of your data. Contact
                privacy@dils.com for any data protection inquiries.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <Button
                onClick={handleSign}
                disabled={
                  submitting ||
                  uploading ||
                  !signerName ||
                  !signerEmail ||
                  !signatureData ||
                  !allCustomFieldsFilled
                }
                className="w-full sm:flex-1"
              >
                {submitting ? "Signing..." : "Sign Document"}
              </Button>
              <Button
                variant="outline"
                className="w-full text-destructive sm:w-auto"
                onClick={() => setMode("reject")}
                disabled={submitting || uploading}
              >
                <AlertTriangle className="mr-1.5 h-4 w-4" />
                Decline
              </Button>
            </div>

            {/* Investor-uploaded NDA — alternative to the signature pad above.
                Same approval gate (admin still has to approve in the drawer)
                but signature & field merging are skipped because the file
                is already a finished, signed PDF. */}
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
                      onClick={() => { setUploadOpen(false); setUploadFile(null); }}
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
                      !signerName ||
                      !signerEmail
                    }
                    className="w-full sm:w-auto"
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
          </div>
        )}

        {/* Rejection form */}
        {mode === "reject" && (
          <div className="rounded-lg border border-red-200 bg-white p-6 space-y-4">
            <h2 className="font-semibold text-destructive">Decline to Sign</h2>
            <p className="text-sm text-muted-foreground">
              Please provide a reason for declining (optional).
            </p>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for declining..."
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="destructive" onClick={handleReject} disabled={submitting} className="w-full sm:flex-1">
                {submitting ? "Submitting..." : "Confirm Decline"}
              </Button>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setMode(null)}>
                Go Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
