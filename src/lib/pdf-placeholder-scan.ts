// @ts-ignore - pdfjs-dist types are finicky
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PlaceholderLocation {
  page: number; // 1-indexed
  x: number; // PDF points from left
  y: number; // PDF points from bottom (pdf-lib convention)
  width: number;
  height: number;
  fontSize: number;
}

export type PlaceholderMap = Record<string, PlaceholderLocation>;

// Match {TOKEN} or {{TOKEN}}, any case. The capture group is normalised to
// UPPERCASE downstream so scanners / generators / form can share one keyspace.
// We accept {a} and {{a}}, but never mismatched ({a}} or {{a}).
const PLACEHOLDER_REGEX = /(?:\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}|\{([a-zA-Z_][a-zA-Z0-9_]*)\})/g;

export async function scanPlaceholders(pdfBytes: Buffer): Promise<PlaceholderMap> {
  const uint8 = new Uint8Array(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  } as any);
  const pdf = await loadingTask.promise;

  const result: PlaceholderMap = {};

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    // Concatenate text items into lines (by Y coordinate)
    // Group items that appear on same line
    const items = textContent.items as any[];

    // Sort by Y descending (top first), then X ascending
    const sorted = [...items].sort((a, b) => {
      const ya = a.transform[5];
      const yb = b.transform[5];
      if (Math.abs(ya - yb) > 2) return yb - ya;
      return a.transform[4] - b.transform[4];
    });

    // Walk through items looking for placeholders (may span multiple items)
    let combined = "";
    let startItem: any = null;
    let endItem: any = null;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const text = item.str || "";
      if (!combined) startItem = item;
      combined += text;
      endItem = item;

      // Check if we have a placeholder
      let match;
      PLACEHOLDER_REGEX.lastIndex = 0;
      while ((match = PLACEHOLDER_REGEX.exec(combined)) !== null) {
        // Capture group 1 is the double-brace variant, group 2 the single-brace
        const rawKey = match[1] ?? match[2];
        if (!rawKey) continue;
        const key = rawKey.toUpperCase();
        // Approximate bbox using start item transform
        const [, , , , x, y] = startItem.transform;
        const fontSize = Math.abs(startItem.transform[0]) || 11;
        const width = (endItem.transform[4] + (endItem.width || 0)) - x;
        const height = fontSize * 1.2;

        // Convert pdfjs (top-left origin going down via baseline) to pdf-lib coords
        // pdfjs y is baseline from bottom. pdf-lib y is also from bottom.
        // So we can use y directly, but subtract descender for better alignment.
        const pdfLibY = y;

        if (!result[key]) {
          result[key] = {
            page: pageNum,
            x,
            y: pdfLibY,
            width,
            height,
            fontSize,
          };
        }
      }

      // Reset if we drift to a new line
      if (i + 1 < sorted.length) {
        const nextItem = sorted[i + 1];
        const currentY = item.transform[5];
        const nextY = nextItem.transform[5];
        if (Math.abs(currentY - nextY) > 2) {
          combined = "";
          startItem = null;
        }
      }
    }
  }

  return result;
}
