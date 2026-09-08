"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, FileText, Mail, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { submitInvestorOffer } from "@/actions/portal-actions";
import { getSignedDocumentUrl } from "@/actions/document-actions";
import { openInNewTab } from "@/lib/open-in-new-tab";
import { formatBid, formatDate } from "@/lib/utils";

// Mirrors the admin OfferSection's currency list — the same three the
// bidCurrency column is written with anywhere else in the app.
const CURRENCIES = ["EUR", "USD", "GBP"];

interface OfferSubmissionProps {
  trackingId: string;
  /** Decimal flattened to string by the server component. */
  bidAmount: string | null;
  bidCurrency: string | null;
  bidSubmittedAt: string | Date | null;
  offerDocument: { id: string; fileName: string } | null;
  /** NBO stage is COMPLETED — the deal team has closed it. */
  locked: boolean;
}

export function OfferSubmission({
  trackingId,
  bidAmount,
  bidCurrency,
  bidSubmittedAt,
  offerDocument,
  locked,
}: OfferSubmissionProps) {
  const router = useRouter();
  const hasOffer = bidAmount != null && String(bidAmount).trim() !== "";

  const [editing, setEditing] = useState(!hasOffer);
  const [amount, setAmount] = useState(hasOffer ? String(bidAmount) : "");
  const [currency, setCurrency] = useState(bidCurrency ?? "EUR");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileName(null);
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      if (fileRef.current) fileRef.current.value = "";
      setFileName(null);
      return;
    }
    setFileName(file.name);
  }

  function handleSubmit() {
    const file = fileRef.current?.files?.[0] ?? null;
    if (!file && !offerDocument) {
      toast.error("Attach your signed offer as a PDF");
      return;
    }
    const fd = new FormData();
    fd.append("trackingId", trackingId);
    fd.append("amount", amount.trim());
    fd.append("currency", currency);
    if (file) fd.append("file", file);

    startSubmit(async () => {
      try {
        const result = await submitInvestorOffer(fd);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't submit your offer");
          return;
        }
        toast.success("Offer submitted. The deal team has been notified.");
        setEditing(false);
        setFileName(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't submit your offer");
      }
    });
  }

  async function handleDownload() {
    if (!offerDocument) return;
    try {
      await openInNewTab(() => getSignedDocumentUrl(offerDocument.id));
    } catch {
      toast.error("Failed to open your offer letter");
    }
  }

  const submittedSummary = hasOffer && (
    <div className="rounded-md border-l-[3px] border-l-status-success bg-status-success-soft p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-status-success">
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
        Offer submitted
      </p>
      <p className="mt-2 font-heading text-2xl font-semibold text-foreground">
        {formatBid(bidAmount, bidCurrency ?? "EUR")}
      </p>
      {bidSubmittedAt && (
        <p className="mt-1 text-xs text-muted-foreground">
          Submitted {formatDate(bidSubmittedAt)}
        </p>
      )}
      {offerDocument && (
        <button
          type="button"
          onClick={handleDownload}
          className="mt-3 inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-dils-700 hover:underline"
          title={offerDocument.fileName}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">{offerDocument.fileName}</span>
        </button>
      )}
    </div>
  );

  if (locked) {
    return (
      <div className="space-y-3">
        {submittedSummary}
        <p className="text-xs italic text-muted-foreground">
          This stage has been closed by the deal team. Contact them directly to
          revise your offer.
        </p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {submittedSummary}
        <Button variant="outline" onClick={() => setEditing(true)}>
          Revise offer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasOffer && submittedSummary}
      <div className="rounded-lg border border-dils-200 bg-white p-5">
        <h4 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {hasOffer ? "Revise your offer" : "Submit your non-binding offer"}
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the amount you are offering and attach your signed offer letter
          as a PDF. The deal team is notified as soon as you submit.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <Label
              htmlFor="offer-amount"
              className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground"
            >
              Offer amount
            </Label>
            <div className="mt-1.5 flex gap-2">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[84px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="offer-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="11300000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
              Signed offer letter (PDF)
            </Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={pickFile}
              className="hidden"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
                {fileName || offerDocument ? "Choose another PDF" : "Choose PDF"}
              </Button>
              {fileName ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-foreground">
                  <Paperclip className="h-3 w-3 shrink-0" strokeWidth={2} />
                  <span className="truncate">{fileName}</span>
                </span>
              ) : offerDocument ? (
                <span className="truncate text-xs text-muted-foreground">
                  Keeping {offerDocument.fileName}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Required · max 10MB
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            className="bg-banner-info-foreground text-white hover:bg-banner-info-foreground/90"
            disabled={submitting || amount.trim() === ""}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting…" : hasOffer ? "Submit revision" : "Submit offer"}
          </Button>
          {hasOffer && (
            <Button
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setEditing(false);
                setAmount(String(bidAmount));
                setCurrency(bidCurrency ?? "EUR");
                setFileName(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Cancel
            </Button>
          )}
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Mail className="h-3 w-3" strokeWidth={2} />
          Sends an email to the deal team
        </p>
      </div>
    </div>
  );
}
