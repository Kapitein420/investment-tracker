"use client";

import { useRef, useState } from "react";
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
import { FileText, Upload, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateTracking } from "@/actions/tracking-actions";
import {
  uploadOfferDocument,
  deleteDocument,
  getSignedDocumentUrl,
} from "@/actions/document-actions";
import { formatBid } from "@/lib/utils";

type OfferDoc = {
  id: string;
  fileName: string;
} | null;

interface OfferSectionProps {
  trackingId: string;
  bidAmount: string | number | null;
  bidCurrency: string | null;
  offerDocument: OfferDoc;
  editable: boolean;
  onChange: () => void;
}

const CURRENCIES = ["EUR", "USD", "GBP"];

export function OfferSection({
  trackingId,
  bidAmount,
  bidCurrency,
  offerDocument,
  editable,
  onChange,
}: OfferSectionProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amountInput, setAmountInput] = useState(
    bidAmount == null ? "" : String(bidAmount)
  );
  const [currency, setCurrency] = useState(bidCurrency ?? "EUR");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasBid = bidAmount != null && String(bidAmount).trim() !== "";

  async function handleSave() {
    const trimmed = amountInput.trim();
    const num = trimmed === "" ? null : Number(trimmed);
    if (num !== null && (Number.isNaN(num) || num < 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await updateTracking(trackingId, {
        bidAmount: num,
        bidCurrency: currency,
        // First-time stamp; admin can clear by setting amount to null.
        bidSubmittedAt: num === null ? null : new Date(),
      });
      toast.success("Offer updated");
      setEditing(false);
      onChange();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setAmountInput(bidAmount == null ? "" : String(bidAmount));
    setCurrency(bidCurrency ?? "EUR");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("trackingId", trackingId);
      await uploadOfferDocument(fd);
      toast.success("Offer PDF uploaded");
      onChange();
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDownload() {
    if (!offerDocument) return;
    try {
      const url = await getSignedDocumentUrl(offerDocument.id);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to get download link");
    }
  }

  async function handleDeleteDoc() {
    if (!offerDocument) return;
    if (!confirm("Remove the offer PDF?")) return;
    setDeleting(true);
    try {
      await deleteDocument(offerDocument.id);
      toast.success("Offer PDF removed");
      onChange();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-md border border-dils-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          NBO Offer
        </Label>
        {editable && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1 h-3 w-3" />
            {hasBid ? "Edit" : "Add"}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-8 w-[72px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="11300000"
              className="h-8 text-xs"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : hasBid ? (
        <div className="text-lg font-semibold text-foreground">
          {formatBid(bidAmount, bidCurrency ?? "EUR")}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">No offer recorded</p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-dils-100 pt-2.5">
        {offerDocument ? (
          <button
            type="button"
            onClick={handleDownload}
            className="flex min-w-0 items-center gap-1.5 text-xs text-dils-700 hover:underline"
            title={offerDocument.fileName}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{offerDocument.fileName}</span>
          </button>
        ) : (
          <p className="text-xs italic text-muted-foreground">No offer PDF</p>
        )}
        {editable && (
          <div className="flex shrink-0 items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" />
              {uploading
                ? "Uploading…"
                : offerDocument
                  ? "Replace"
                  : "Upload PDF"}
            </Button>
            {offerDocument && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deleting}
                onClick={handleDeleteDoc}
                title="Remove offer PDF"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
