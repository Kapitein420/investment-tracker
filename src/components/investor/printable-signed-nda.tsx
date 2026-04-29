"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Props {
  data: {
    documentId: string;
    assetTitle: string;
    signedAt: Date | null;
    signedByName: string | null;
    signedByEmail: string | null;
    signedHtml: string;
  };
}

export function PrintableSignedNda({ data }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const searchParams = useSearchParams();
  const autoDownload = searchParams?.get("download") === "1";
  const autoDownloadFiredRef = useRef(false);

  async function handleDownload() {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      // Lazy-load the PDF stack — keeps initial bundle slim and avoids
      // pulling html2canvas / jspdf into routes that don't need them.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Slice the canvas across multiple A4 pages instead of letting jsPDF
      // squash a tall NDA onto one page.
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = (data.signedByName || "investor")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase();
      const fileName = `NDA-${data.assetTitle}-${safeName}.pdf`.replace(/\s+/g, "-");
      pdf.save(fileName);
    } catch (e: any) {
      console.error("[PrintableSignedNda] download failed:", e);
      toast.error("Could not generate PDF. Try again or use browser print.");
    } finally {
      setDownloading(false);
    }
  }

  // When opened with ?download=1 (from the deal-journey "Download" button),
  // fire the PDF generation once the rendered HTML is in the DOM. We need
  // a tick so the dangerouslySetInnerHTML content has actually painted —
  // html2canvas otherwise captures a 0-height snapshot.
  useEffect(() => {
    if (!autoDownload) return;
    if (autoDownloadFiredRef.current) return;
    autoDownloadFiredRef.current = true;
    const t = window.setTimeout(() => {
      handleDownload();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDownload]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-2.5 print:hidden sm:px-6 sm:py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-3">
          <Link
            href="/portal"
            className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to portal</span>
            <span className="sm:hidden">Portal</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-muted-foreground">Signed by</p>
              <p className="text-sm font-medium">{data.signedByName}</p>
            </div>
            <Button size="sm" onClick={handleDownload} disabled={downloading}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">{downloading ? "Generating…" : "Download PDF"}</span>
              <span className="sm:hidden">{downloading ? "…" : "PDF"}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4 print:p-0 sm:p-6">
        {/* Next-steps callout — hidden in the PDF capture so it doesn't end up in the legal record */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 print:hidden">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Mail className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">NDA signed — what's next</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                The deal team will be in touch shortly with the next step. The Information Memorandum unlocks once the NDA is approved on our side. You can download a copy above for your records.
              </p>
            </div>
          </div>
        </div>

        <div
          ref={contentRef}
          className="rounded-xl border bg-white p-5 shadow-sm sm:p-8 lg:p-12 print:border-0 print:shadow-none print:p-0"
        >
          <div
            className="prose prose-sm max-w-none text-[13px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: data.signedHtml }}
          />
        </div>
      </main>
    </div>
  );
}
