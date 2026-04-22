"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SignaturePad } from "@/components/signing/signature-pad";
import { DynamicFieldInputs, extractCustomFields } from "@/components/signing/dynamic-fields";
import {
  FileText, Check, X, AlertTriangle, Pen, Download, Loader2,
} from "lucide-react";
import {
  signDocument,
  rejectDocument,
  getSignedDocumentUrl,
  getDocumentPlaceholderInfo,
} from "@/actions/document-actions";
import { toast } from "sonner";

interface SigningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    fileName: string;
    fileUrl: string; // storage path
    status: string;
    stage: { key: string; label: string };
  };
  token: string;
  companyName: string;
  assetTitle: string;
  defaultName?: string;
  defaultEmail?: string;
}

export function SigningModal({
  open,
  onOpenChange,
  document: doc,
  token,
  companyName,
  assetTitle,
  defaultName,
  defaultEmail,
}: SigningModalProps) {
  const router = useRouter();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [mode, setMode] = useState<"sign" | "reject" | null>(null);
  const [signerName, setSignerName] = useState(defaultName ?? "");
  const [signerEmail, setSignerEmail] = useState(defaultEmail ?? "");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<"signed" | "rejected" | null>(null);

  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const allCustomFieldsFilled = customFieldKeys.every(
    (k) => (fieldValues[k] ?? "").trim().length > 0
  );

  // Fetch signed URL + placeholder map when modal opens
  useEffect(() => {
    if (open && !pdfUrl) {
      setLoadingPdf(true);
      getSignedDocumentUrl(doc.id)
        .then(setPdfUrl)
        .catch(() => toast.error("Failed to load document"))
        .finally(() => setLoadingPdf(false));

      getDocumentPlaceholderInfo(doc.id)
        .then((info) => {
          if (!info) {
            setCustomFieldKeys([]);
            return;
          }
          const all = extractCustomFields(info.placeholderMap);
          // Hide tokens the admin has already set as defaults on the asset
          const visible = all.filter((k) => !(k in info.assetFieldDefaults));
          setCustomFieldKeys(visible);
        })
        .catch(() => setCustomFieldKeys([]));
    }
  }, [open, doc.id, pdfUrl]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setPdfUrl(null);
      setMode(null);
      setSignerName(defaultName ?? "");
      setSignerEmail(defaultEmail ?? "");
      setSignatureData(null);
      setRejectionReason("");
      setSubmitting(false);
      setFieldValues({});
      setCustomFieldKeys([]);
      if (completed) {
        setCompleted(null);
        router.refresh();
      }
    }
  }, [open, completed, router, defaultName, defaultEmail]);

  async function handleSign() {
    if (!signerName || !signerEmail || !signatureData) {
      toast.error("Please fill in all fields and provide your signature");
      return;
    }
    if (!allCustomFieldsFilled) {
      toast.error("Please fill in all document fields");
      return;
    }
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
      toast.error(e.message || "Failed to sign document");
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
      toast.error(e.message || "Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    const url = await getSignedDocumentUrl(doc.id);
    window.open(url, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-0 sm:max-h-[90vh] sm:w-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 pr-8">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-sm sm:text-base">{doc.fileName}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {assetTitle} &middot; {companyName} &middot;
                  <Badge variant="outline" className="ml-1 text-[10px]">{doc.stage.label}</Badge>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Completed state */}
        {completed && (
          <div className="p-8 text-center">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              completed === "signed" ? "bg-logistics-soft" : "bg-destructive/10"
            }`}>
              {completed === "signed" ? (
                <Check className="h-8 w-8 text-status-success" />
              ) : (
                <X className="h-8 w-8 text-destructive" />
              )}
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              {completed === "signed" ? "Document Signed Successfully" : "Document Declined"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {completed === "signed"
                ? "Your signature has been recorded. The deal team will review and approve your NDA."
                : "Your response has been recorded."}
            </p>

            {completed === "signed" && signatureData && (
              <div className="mt-4 inline-block rounded-lg border bg-muted p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Your signature</p>
                <img src={signatureData} alt="Signature" className="h-12 opacity-80" />
              </div>
            )}

            <div className="mt-6 flex justify-center gap-3">
              {completed === "signed" && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download Document
                </Button>
              )}
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Signing flow */}
        {!completed && (
          <div className="p-4 space-y-6 sm:p-6">
            {/* PDF viewer */}
            <div className="rounded-lg border overflow-hidden bg-muted">
              {loadingPdf ? (
                <div className="flex h-[50vh] min-h-[300px] items-center justify-center md:h-[500px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pdfUrl ? (
                <>
                  <embed
                    src={pdfUrl}
                    type="application/pdf"
                    className="h-[50vh] min-h-[300px] w-full md:h-[500px]"
                  />
                  <div className="border-t bg-white px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => window.open(pdfUrl, "_blank")}
                      className="text-xs text-foreground underline hover:text-destructive"
                    >
                      Open PDF in a new tab
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex h-[50vh] min-h-[300px] items-center justify-center text-sm text-muted-foreground md:h-[500px]">
                  Unable to load document
                </div>
              )}
            </div>

            <Separator />

            {/* Sign form */}
            {mode !== "reject" && (
              <div className="space-y-4">
                <h3 className="font-semibold">Sign this document</h3>

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
                    <Input value={new Date().toLocaleDateString("en-GB")} disabled className="bg-muted" />
                  </div>
                </div>

                {customFieldKeys.length > 0 && (
                  <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
                    <div>
                      <p className="font-heading text-sm font-semibold text-foreground">Document fields</p>
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

                <div className="rounded-md bg-muted border p-3 text-[11px] text-muted-foreground space-y-2">
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
                      !signerName ||
                      !signerEmail ||
                      !signatureData ||
                      !allCustomFieldsFilled
                    }
                    className="w-full sm:flex-1"
                  >
                    {submitting ? (
                      <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Signing...</>
                    ) : (
                      <><Pen className="mr-1.5 h-4 w-4" />Sign Document</>
                    )}
                  </Button>
                  <Button variant="outline" className="w-full text-destructive sm:w-auto" onClick={() => setMode("reject")}>
                    <AlertTriangle className="mr-1.5 h-4 w-4" />
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {/* Reject form */}
            {mode === "reject" && (
              <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/10/50 p-4">
                <h3 className="font-semibold text-destructive">Decline to Sign</h3>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
