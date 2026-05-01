"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Mail, Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Props {
  data: {
    documentId: string;
    assetId: string | null;
    assetTitle: string;
    signedAt: Date | null;
    signedByName: string | null;
    signedByEmail: string | null;
    signedHtml: string;
  };
}

// A4 page in millimetres
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 16;
const HEADER_HEIGHT_MM = 14;
const FOOTER_HEIGHT_MM = 14;

const CONTENT_LEFT_MM = MARGIN_MM;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_TOP_MM = HEADER_HEIGHT_MM + 6; // 6mm gap below header rule
const CONTENT_BOTTOM_MM = PAGE_HEIGHT_MM - FOOTER_HEIGHT_MM - 4;
const CONTENT_HEIGHT_MM = CONTENT_BOTTOM_MM - CONTENT_TOP_MM;

function formatLongDate(d: Date | string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/dils-logo.png", { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function PrintableSignedNda({ data }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const searchParams = useSearchParams();
  const autoDownload = searchParams?.get("download") === "1";
  const autoDownloadFiredRef = useRef(false);

  function handlePrint() {
    // Native browser print → "Save as PDF" produces a text-selectable PDF
    // with whatever the browser's print rendering looks like. Cheaper for
    // large NDAs than the html2canvas+jspdf flow, and fully accessible.
    window.print();
  }

  async function handleDownload() {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      // Lazy-load the PDF stack — keeps initial bundle slim and avoids
      // pulling html2canvas / jspdf into routes that don't need them.
      const [{ default: html2canvas }, { jsPDF }, logoDataUrl] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
        loadLogoDataUrl(),
      ]);

      // Higher scale → crisper text in the rasterised slice. 3 is the
      // sweet-spot vs file size; 4 doubled the file with marginal gain.
      const canvas = await html2canvas(contentRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      pdf.setProperties({
        title: `NDA - ${data.assetTitle}${data.signedByName ? ` - ${data.signedByName}` : ""}`,
        subject: "Non-Disclosure Agreement",
        author: "DILS Group B.V.",
        keywords: "NDA, DILS, signed",
        creator: "DILS Investment Portal",
      });

      // Pixels-per-mm of the captured canvas, derived from the content
      // width we want each page to use. Slicing along this scale keeps
      // text size consistent across all pages.
      const canvasWidthPx = canvas.width;
      const canvasHeightPx = canvas.height;
      const pxPerMm = canvasWidthPx / CONTENT_WIDTH_MM;
      const contentHeightPx = CONTENT_HEIGHT_MM * pxPerMm;
      const pageCount = Math.max(1, Math.ceil(canvasHeightPx / contentHeightPx));

      const drawHeader = () => {
        // Header is now text-only — the previous brand-kit logo had a 4:1
        // aspect that pdfkit's fixed 24x8 box stretched on output. Right-
        // aligned doc-type label is enough to identify the page.
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(31, 41, 55);
        const headerRight = `Non-Disclosure Agreement · ${data.assetTitle}`;
        const maxRightWidth = PAGE_WIDTH_MM - MARGIN_MM * 2;
        let displayed = headerRight;
        let displayedWidth = pdf.getTextWidth(displayed);
        while (displayedWidth > maxRightWidth && displayed.length > 8) {
          displayed = displayed.slice(0, -1);
          displayedWidth = pdf.getTextWidth(displayed + "…");
        }
        if (displayed !== headerRight) displayed = displayed + "…";
        const rightX = PAGE_WIDTH_MM - MARGIN_MM - pdf.getTextWidth(displayed);
        pdf.text(displayed, rightX, MARGIN_MM);

        // Underline rule beneath header
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.2);
        pdf.line(MARGIN_MM, MARGIN_MM + 4, PAGE_WIDTH_MM - MARGIN_MM, MARGIN_MM + 4);
      };

      const drawFooter = (pageNum: number, total: number) => {
        const footerY = PAGE_HEIGHT_MM - FOOTER_HEIGHT_MM;
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.2);
        pdf.line(MARGIN_MM, footerY, PAGE_WIDTH_MM - MARGIN_MM, footerY);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);

        const signedDate = formatLongDate(data.signedAt);
        const signedByLine = data.signedByName
          ? `Signed by ${data.signedByName}${signedDate ? ` · ${signedDate}` : ""}`
          : "Unsigned record";
        pdf.text(signedByLine, MARGIN_MM, footerY + 5);

        const pageText = `Page ${pageNum} of ${total}`;
        const pageTextWidth = pdf.getTextWidth(pageText);
        pdf.text(pageText, PAGE_WIDTH_MM - MARGIN_MM - pageTextWidth, footerY + 5);

        // Document ID — subtle, second line. Kept for audit cross-reference
        // even though the corporate footer was removed; CUIDs aren't
        // guessable and the /portal/signed-nda/[id] route enforces
        // per-tracking access control, so showing it here doesn't grant
        // any extra reach.
        pdf.setFontSize(6);
        pdf.setTextColor(170, 174, 181);
        pdf.text(`Doc ID: ${data.documentId}`, MARGIN_MM, footerY + 9);
      };

      // Slice the captured canvas into per-page chunks. We composite each
      // slice onto its own canvas so the PNG we embed is exactly the page
      // body height — keeps header/footer space pristine, no overlap.
      for (let p = 0; p < pageCount; p++) {
        if (p > 0) pdf.addPage();

        const sliceTopPx = Math.floor(p * contentHeightPx);
        const sliceHeightPx = Math.min(
          Math.ceil(contentHeightPx),
          canvasHeightPx - sliceTopPx
        );

        if (sliceHeightPx <= 0) {
          drawHeader();
          drawFooter(p + 1, pageCount);
          continue;
        }

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvasWidthPx;
        sliceCanvas.height = sliceHeightPx;
        const sliceCtx = sliceCanvas.getContext("2d");
        if (sliceCtx) {
          sliceCtx.fillStyle = "#FFFFFF";
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0, sliceTopPx, canvasWidthPx, sliceHeightPx,
            0, 0, canvasWidthPx, sliceHeightPx,
          );
        }

        const sliceImgData = sliceCanvas.toDataURL("image/png");
        const sliceHeightMm = sliceHeightPx / pxPerMm;
        pdf.addImage(
          sliceImgData,
          "PNG",
          CONTENT_LEFT_MM,
          CONTENT_TOP_MM,
          CONTENT_WIDTH_MM,
          sliceHeightMm,
          undefined,
          "FAST"
        );

        drawHeader();
        drawFooter(p + 1, pageCount);
      }

      const safeName = (data.signedByName || "investor")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase();
      const fileName = `NDA-${data.assetTitle}-${safeName}.pdf`.replace(/\s+/g, "-");
      pdf.save(fileName);
    } catch (e: any) {
      console.error("[PrintableSignedNda] download failed:", e);
      toast.error("Could not generate PDF. Try the Print button or contact the deal team.");
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
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-2.5 print:hidden sm:px-6 sm:py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-3">
          <Link
            href={data.assetId ? `/portal/${data.assetId}` : "/portal"}
            className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{data.assetId ? "Back to deal" : "Back to portal"}</span>
            <span className="sm:hidden">{data.assetId ? "Deal" : "Portal"}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-muted-foreground">Signed by</p>
              <p className="text-sm font-medium">{data.signedByName}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="hidden sm:inline-flex">
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
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

        {/* Captured content. The `nda-print-surface` class keeps print-CSS rules
            scoped to this block so the browser's native Print also produces a
            clean, header-less, full-bleed page. */}
        <div
          ref={contentRef}
          className="nda-print-surface rounded-xl border bg-white p-5 shadow-sm sm:p-8 lg:p-12 print:border-0 print:shadow-none print:p-0"
        >
          {/* Cover-style metadata block. Only shows on screen + native print —
              the html2canvas capture includes it as the first page. */}
          <div className="mb-6 border-b pb-5 print:mb-8 print:pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Non-Disclosure Agreement
                </p>
                <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {data.assetTitle}
                </h2>
              </div>
              <Image
                src="/dils-logo.png"
                alt="DILS"
                width={88}
                height={28}
                className="h-7 w-auto object-contain shrink-0 sm:h-8"
              />
            </div>
            {(data.signedByName || data.signedAt) && (
              <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {data.signedByName && (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">Signed by</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{data.signedByName}</dd>
                  </div>
                )}
                {data.signedAt && (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">Signed on</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{formatLongDate(data.signedAt)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          <div
            className="prose prose-sm max-w-none text-[13px] leading-relaxed [&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading [&_p]:break-inside-avoid [&_li]:break-inside-avoid"
            dangerouslySetInnerHTML={{ __html: data.signedHtml }}
          />
        </div>
      </main>

      {/* Print-only stylesheet — produces a clean A4 layout when the user
          hits Cmd/Ctrl+P or our Print button (browsers' "Save as PDF"
          option from this dialog gives text-selectable output). */}
      <style jsx global>{`
        /* The HTML NDA template wraps every fillable value in
           <span class="field"> with a border-bottom that visualises
           the "____" line in the unsigned preview. In the signed
           render the field IS filled, but inline-block baseline
           alignment puts that border roughly at the surrounding text's
           baseline — which html2canvas captures as a strikethrough
           through the typed value. Strip the underline + minimum width
           on the printable surface so signed values render cleanly in
           both the on-screen view and the rasterised PDF download. */
        .nda-print-surface .nda-doc .field,
        .nda-print-surface .nda-doc .field-inline {
          border-bottom: 0 !important;
          padding-bottom: 0 !important;
          min-width: 0 !important;
        }

        @media print {
          @page {
            size: A4;
            margin: 16mm;
          }
          body {
            background: white !important;
          }
          .nda-print-surface {
            page-break-inside: auto;
          }
          .nda-print-surface p,
          .nda-print-surface li,
          .nda-print-surface h1,
          .nda-print-surface h2,
          .nda-print-surface h3 {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
