"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/signing/signature-pad";
import { FileText, Check, X, AlertTriangle, Download } from "lucide-react";
import { signDocument, rejectDocument, getSignedDocumentUrl } from "@/actions/document-actions";
import { toast } from "sonner";

interface SigningPageProps {
  document: {
    id: string;
    fileName: string;
    fileUrl: string;
    status: string;
    stage: { label: string };
    tracking: {
      company: { name: string };
      asset: { title: string };
    };
  };
  token: string;
}

export function SigningPage({ document: doc, token }: SigningPageProps) {
  const [mode, setMode] = useState<"sign" | "reject" | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<"signed" | "rejected" | null>(null);

  async function handleSign() {
    if (!signerName || !signerEmail || !signatureData) {
      toast.error("Please fill in all fields and provide your signature");
      return;
    }
    setSubmitting(true);
    try {
      await signDocument({ token, signedByName: signerName, signedByEmail: signerEmail, signatureData });
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
        <div className="mx-auto max-w-3xl px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex flex-col leading-none">
              <span className="font-heading text-2xl font-bold tracking-tight text-dils-black">DILS</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Document Signing</span>
            </div>
            <div className="h-10 w-px bg-dils-200" />
            <div>
              <h1 className="font-heading text-lg font-semibold">Document Signing Request</h1>
              <p className="text-sm text-muted-foreground">
                {doc.tracking.asset.title} &middot; {doc.tracking.company.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-6 space-y-6">
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
            className="w-full"
            style={{ height: "min(500px, 50vh)" }}
          />
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

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSign} disabled={submitting || !signerName || !signerEmail || !signatureData} className="flex-1">
                {submitting ? "Signing..." : "Sign Document"}
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => setMode("reject")}>
                <AlertTriangle className="mr-1.5 h-4 w-4" />
                Decline
              </Button>
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
            <div className="flex gap-3">
              <Button variant="destructive" onClick={handleReject} disabled={submitting} className="flex-1">
                {submitting ? "Submitting..." : "Confirm Decline"}
              </Button>
              <Button variant="outline" onClick={() => setMode(null)}>
                Go Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
