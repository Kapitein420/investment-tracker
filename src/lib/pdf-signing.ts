import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatCertTimestamp } from "@/lib/utils";

export interface FieldPlacement {
  type: "signature" | "name" | "date";
  page: number; // -1 = last page, or 1-indexed
  // Legacy/grid mode: named position like "bottom-center"
  position?: string;
  // Manual mode: explicit PDF points (origin bottom-left, pdf-lib convention)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const SIGNATURE_WIDTH = 150;
const SIGNATURE_HEIGHT = 50;
const FONT_SIZE = 11;
const MARGIN = 50;
const LABEL_SIZE = 7;

/**
 * Calculate x,y coordinates from a position string.
 * PDF coordinates: origin at bottom-left.
 */
function getCoordinates(
  position: string,
  pageWidth: number,
  pageHeight: number,
  elementWidth: number,
  elementHeight: number
): { x: number; y: number } {
  const [vertical, horizontal] = position.split("-") as [string, string];

  let x: number;
  switch (horizontal) {
    case "left":
      x = MARGIN;
      break;
    case "center":
      x = (pageWidth - elementWidth) / 2;
      break;
    case "right":
      x = pageWidth - MARGIN - elementWidth;
      break;
    default:
      x = (pageWidth - elementWidth) / 2;
  }

  let y: number;
  switch (vertical) {
    case "bottom":
      y = MARGIN;
      break;
    case "middle":
      y = (pageHeight - elementHeight) / 2;
      break;
    case "top":
      y = pageHeight - MARGIN - elementHeight;
      break;
    default:
      y = MARGIN;
  }

  return { x, y };
}

/**
 * Embed signature, name, and date onto a PDF at configured positions.
 */
export async function generateSignedPdf(
  originalPdfBytes: Buffer | Uint8Array,
  signatureDataUrl: string, // base64 PNG data URL
  signerName: string,
  signerDate: string,
  fieldConfig: FieldPlacement[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  // Parse signature PNG from data URL
  const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  const signatureBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  for (const field of fieldConfig) {
    // Resolve page index
    const pageIndex = field.page === -1 ? pages.length - 1 : field.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // MANUAL mode: use explicit x/y/width/height if present (pdf-lib coords: origin bottom-left)
    const hasExplicitCoords =
      typeof field.x === "number" &&
      typeof field.y === "number" &&
      typeof field.width === "number" &&
      typeof field.height === "number";

    if (field.type === "signature") {
      if (hasExplicitCoords) {
        const x = field.x as number;
        const y = field.y as number;
        const w = field.width as number;
        const h = field.height as number;

        // Embed signature image filling the exact rectangle
        page.drawImage(signatureImage, { x, y, width: w, height: h });

        // Thin baseline under signature
        page.drawLine({
          start: { x, y: y - 2 },
          end: { x: x + w, y: y - 2 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
      } else {
        const { x, y } = getCoordinates(
          field.position ?? "bottom-center",
          pageWidth,
          pageHeight,
          SIGNATURE_WIDTH,
          SIGNATURE_HEIGHT + 20 // extra for label
        );

        // Draw signature label
        page.drawText("Signature", {
          x,
          y: y + SIGNATURE_HEIGHT + 4,
          size: LABEL_SIZE,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });

        // Draw signature image
        page.drawImage(signatureImage, {
          x,
          y,
          width: SIGNATURE_WIDTH,
          height: SIGNATURE_HEIGHT,
        });

        // Draw line under signature
        page.drawLine({
          start: { x, y: y - 2 },
          end: { x: x + SIGNATURE_WIDTH, y: y - 2 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
      }
    }

    if (field.type === "name") {
      if (hasExplicitCoords) {
        const x = field.x as number;
        const y = field.y as number;
        const w = field.width as number;
        const h = field.height as number;

        // Fit font size to the box height (leave small padding)
        const size = Math.max(8, Math.min(FONT_SIZE, h - 4));
        // Draw name; pdf-lib text origin is baseline at (x, y), so offset by a small pad
        page.drawText(signerName, {
          x,
          y: y + 2,
          size,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
      } else {
        const textWidth = font.widthOfTextAtSize(signerName, FONT_SIZE);
        const { x, y } = getCoordinates(
          field.position ?? "bottom-left",
          pageWidth,
          pageHeight,
          Math.max(textWidth, 120),
          FONT_SIZE + 20
        );

        // Label
        page.drawText("Name", {
          x,
          y: y + FONT_SIZE + 8,
          size: LABEL_SIZE,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });

        // Name text
        page.drawText(signerName, {
          x,
          y,
          size: FONT_SIZE,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Underline
        page.drawLine({
          start: { x, y: y - 3 },
          end: { x: x + Math.max(textWidth, 120), y: y - 3 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
      }
    }

    if (field.type === "date") {
      if (hasExplicitCoords) {
        const x = field.x as number;
        const y = field.y as number;
        const h = field.height as number;

        const size = Math.max(8, Math.min(FONT_SIZE, h - 4));
        page.drawText(signerDate, {
          x,
          y: y + 2,
          size,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
      } else {
        const textWidth = font.widthOfTextAtSize(signerDate, FONT_SIZE);
        const { x, y } = getCoordinates(
          field.position ?? "bottom-right",
          pageWidth,
          pageHeight,
          Math.max(textWidth, 80),
          FONT_SIZE + 20
        );

        // Label
        page.drawText("Date", {
          x,
          y: y + FONT_SIZE + 8,
          size: LABEL_SIZE,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });

        // Date text
        page.drawText(signerDate, {
          x,
          y,
          size: FONT_SIZE,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Underline
        page.drawLine({
          start: { x, y: y - 3 },
          end: { x: x + Math.max(textWidth, 80), y: y - 3 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
      }
    }
  }

  return pdfDoc.save();
}

// ─── Signature certificate (G8 / BW 3:15a) ─────────────────────────────────

export interface SignatureCertificateInfo {
  documentTitle: string;
  dealName: string;
  companyName: string;
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  signerIp: string | null;
  signerUserAgent: string | null;
  signingTokenId: string;
  /** SHA-256 hex of the PDF bytes BEFORE this certificate page is appended. */
  documentSha256: string;
  intentConfirmedAt: Date;
}

const CERT_MARGIN = 50;
const CERT_TITLE_SIZE = 16;
const CERT_LABEL_SIZE = 8;
const CERT_VALUE_SIZE = 10;
const CERT_ROW_GAP = 16;

/** Greedy line-wrap that also hard-splits a single token wider than
 *  maxWidth (e.g. the 64-char SHA-256 hash, which has no spaces to wrap on). */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (current) lines.push(current);
    current = "";
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let remaining = word;
    while (font.widthOfTextAtSize(remaining, size) > maxWidth) {
      let cut = remaining.length;
      while (cut > 1 && font.widthOfTextAtSize(remaining.slice(0, cut), size) > maxWidth) {
        cut--;
      }
      flush();
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut);
    }
    const candidate = current ? `${current} ${remaining}` : remaining;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      flush();
      current = remaining;
    } else {
      current = candidate;
    }
  }
  flush();
  return lines.length ? lines : [""];
}

/**
 * Append a plain "Signature certificate" page to a signed PDF — the
 * completion-certificate evidence BW 3:15a expects alongside the signature
 * itself (compliance gap G8). Matches the last page's dimensions so the
 * certificate doesn't look like a foreign insert.
 *
 * `documentSha256` must be computed over `pdfBytes` (i.e. BEFORE this call)
 * — the certificate records the hash of the document it certifies, not of
 * itself. The caller then re-hashes the RETURNED bytes for storage, so
 * Document.pdfSha256 always matches what a downloader actually receives.
 */
export async function appendSignatureCertificatePage(
  pdfBytes: Buffer | Uint8Array,
  info: SignatureCertificateInfo
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const lastPage = pdfDoc.getPages().at(-1);
  const { width, height } = lastPage ? lastPage.getSize() : { width: 595.28, height: 841.89 };
  const page = pdfDoc.addPage([width, height]);
  const contentWidth = width - CERT_MARGIN * 2;

  let y = height - CERT_MARGIN - CERT_TITLE_SIZE;
  page.drawText("Signature certificate", {
    x: CERT_MARGIN,
    y,
    size: CERT_TITLE_SIZE,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.13),
  });
  y -= 18;
  page.drawLine({
    start: { x: CERT_MARGIN, y },
    end: { x: width - CERT_MARGIN, y },
    thickness: 0.75,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 22;

  const rows: Array<[string, string]> = [
    ["Document", info.documentTitle],
    ["Deal / asset", info.dealName],
    ["Company", info.companyName],
    ["Signer", `${info.signerName} <${info.signerEmail}>`],
    ["Signed at", formatCertTimestamp(info.signedAt)],
    ["Signer IP address", info.signerIp ?? "unavailable"],
    ["Browser identifier", info.signerUserAgent ?? "unavailable"],
    ["Signing token", info.signingTokenId],
    ["Document SHA-256 (before this certificate page)", info.documentSha256],
    ["Intent confirmed", `yes (${formatCertTimestamp(info.intentConfirmedAt)})`],
  ];

  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), {
      x: CERT_MARGIN,
      y,
      size: CERT_LABEL_SIZE,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    y -= CERT_LABEL_SIZE + 4;

    for (const line of wrapText(value, fontBold, CERT_VALUE_SIZE, contentWidth)) {
      page.drawText(line, {
        x: CERT_MARGIN,
        y,
        size: CERT_VALUE_SIZE,
        font: fontBold,
        color: rgb(0.06, 0.09, 0.13),
      });
      y -= CERT_VALUE_SIZE + 4;
    }
    y -= CERT_ROW_GAP;
  }

  y -= 6;
  page.drawLine({
    start: { x: CERT_MARGIN, y },
    end: { x: width - CERT_MARGIN, y },
    thickness: 0.75,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 20;
  page.drawText("Recorded by Dils Netherlands B.V. · Investor Portal", {
    x: CERT_MARGIN,
    y,
    size: CERT_LABEL_SIZE,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });

  return pdfDoc.save();
}

export async function generateSignedPdfFromPlaceholders(
  originalPdfBytes: Buffer | Uint8Array,
  signatureDataUrl: string,
  fieldValues: Record<string, string | null | undefined>,
  placeholderMap: Record<string, any>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  // Parse signature PNG
  const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  const signatureBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  for (const [key, loc] of Object.entries(placeholderMap)) {
    if (!loc || typeof loc.page !== "number") continue;
    const pageIndex = loc.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    // White-out the placeholder text
    page.drawRectangle({
      x: loc.x - 2,
      y: loc.y - 2,
      width: loc.width + 4,
      height: loc.height + 4,
      color: rgb(1, 1, 1),
    });

    // Check if it's a signature variant
    const isSignature = key === "SIGNATURE" || key.startsWith("SIGNATURE_");

    if (isSignature) {
      // Embed signature image at placeholder location
      const sigHeight = Math.max(loc.height * 2.5, 30);
      const sigWidth = sigHeight * 3; // 3:1 aspect ratio
      page.drawImage(signatureImage, {
        x: loc.x,
        y: loc.y - (sigHeight - loc.height) / 2,
        width: sigWidth,
        height: sigHeight,
      });
    } else {
      // Draw text value — accept exact key or trailing _N variant (e.g. NAME_2)
      const value =
        fieldValues[key] ?? fieldValues[key.replace(/_\d+$/, "")] ?? "";
      if (value) {
        page.drawText(String(value), {
          x: loc.x,
          y: loc.y,
          size: loc.fontSize || 11,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
    }
  }

  return pdfDoc.save();
}
