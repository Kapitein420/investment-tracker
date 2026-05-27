"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { getHtmlNdaForSigning } from "@/actions/html-nda-actions";
import { renderBlankNdaPreview, openNdaPrintWindow } from "@/lib/html-nda-print";

interface Props {
  token: string;
}

/**
 * Investor-side "download empty NDA" button. The investor's per-tracking
 * Document already carries an unused SigningToken (we only render this
 * button alongside Sign Now, i.e. when canSign is true), so we use the
 * existing public getHtmlNdaForSigning(token) endpoint to fetch the
 * template + admin defaults — no investor-only download action needed.
 *
 * Output matches the admin Download button exactly: investor-fillable
 * fields render as `[Label]` placeholders, the print dialog fires for
 * Save-as-PDF, and the investor can sign by hand and re-upload via the
 * existing "Upload PDF" button next to this one.
 */
export function InvestorNdaDownload({ token }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const data = await getHtmlNdaForSigning(token);
      if (!data) {
        toast.error("Could not load NDA template. The link may have expired.");
        return;
      }
      const previewHtml = renderBlankNdaPreview(
        data.html,
        data.fields,
        data.adminFieldDefaults,
      );
      if (!openNdaPrintWindow(previewHtml)) {
        toast.error("Please allow pop-ups to download the NDA.");
      }
    } catch {
      toast.error("Failed to download NDA");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full sm:w-auto"
      onClick={handleClick}
      disabled={loading}
      title="Download a blank PDF to sign by hand, then upload it via Upload PDF"
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {loading ? "Loading…" : "Download"}
    </Button>
  );
}
