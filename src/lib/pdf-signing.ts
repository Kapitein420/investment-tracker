import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

export async function generateSignedPdfFromPlaceholders(
  originalPdfBytes: Buffer | Uint8Array,
  signatureDataUrl: string,
  signerName: string,
  signerDate: string,
  placeholderMap: Record<string, any>,
  signerEmail?: string,
  signerCompany?: string,
  signerTitle?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  // Parse signature PNG
  const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  const signatureBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  const values: Record<string, string | null> = {
    NAME: signerName,
    DATE: signerDate,
    EMAIL: signerEmail ?? null,
    COMPANY: signerCompany ?? null,
    TITLE: signerTitle ?? null,
  };

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
      // Draw text value
      const value = values[key] ?? values[key.replace(/_\d+$/, "")] ?? "";
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
