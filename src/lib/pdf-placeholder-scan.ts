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
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Group items into lines by Y coordinate. Each line is walked as a single
    // concatenated string so that a token split across two runs (e.g. Word
    // emitting `{BUILDING` + `_NAME}` as separate items) still matches the
    // regex. Every character in the concatenated string carries back to the
    // original item that produced it, so when we find a match we can read the
    // coordinate from the item the token actually STARTED in — critical when a
    // single line contains more than one placeholder (e.g. "{BUILDING_NAME}, {CITY}").

    // Sort by Y descending (top first), then X ascending
    const sorted = [...items].sort((a, b) => {
      const ya = a.transform[5];
      const yb = b.transform[5];
      if (Math.abs(ya - yb) > 2) return yb - ya;
      return a.transform[4] - b.transform[4];
    });

    // Build lines
    const lines: Array<{ items: any[]; y: number }> = [];
    let current: { items: any[]; y: number } | null = null;
    for (const item of sorted) {
      const y = item.transform[5];
      if (!current || Math.abs(current.y - y) > 2) {
        current = { items: [item], y };
        lines.push(current);
      } else {
        current.items.push(item);
      }
    }

    for (const line of lines) {
      // Concatenate with a character-to-item index
      let combined = "";
      // itemByChar[i] = the item that produced the character at index i in `combined`
      const itemByChar: any[] = [];
      for (const item of line.items) {
        const text: string = item.str || "";
        for (let c = 0; c < text.length; c++) {
          itemByChar.push(item);
        }
        combined += text;
      }

      // Find all placeholder matches and read coordinates from the item each
      // match started in, not from the first item of the line.
      PLACEHOLDER_REGEX.lastIndex = 0;
      let match;
      while ((match = PLACEHOLDER_REGEX.exec(combined)) !== null) {
        const rawKey = match[1] ?? match[2];
        if (!rawKey) continue;
        const key = rawKey.toUpperCase();
        if (result[key]) continue; // Keep first occurrence only

        const startIdx = match.index;
        const endIdx = startIdx + match[0].length - 1;
        const startItem = itemByChar[startIdx] ?? line.items[0];
        const endItem = itemByChar[endIdx] ?? startItem;

        const [, , , , startX, startY] = startItem.transform;
        const fontSize = Math.abs(startItem.transform[0]) || 11;
        const endX = endItem.transform[4] + (endItem.width || 0);
        const width = Math.max(endX - startX, fontSize * match[0].length * 0.5);
        const height = fontSize * 1.2;

        result[key] = {
          page: pageNum,
          x: startX,
          y: startY,
          width,
          height,
          fontSize,
        };
      }
    }
  }

  return result;
}
