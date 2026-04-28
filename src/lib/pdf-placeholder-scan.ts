// pdfjs-dist v5 references DOMMatrix / Path2D / ImageData at module load.
// On Vercel's Node runtime none of those exist, which crashes the asset
// page (`ReferenceError: DOMMatrix is not defined`) the moment any code
// path touches the scanner. We install a minimal polyfill, then dynamic-
// import pdfjs so the polyfill is in place before the module evaluates.

export interface PlaceholderLocation {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export type PlaceholderMap = Record<string, PlaceholderLocation>;

const PLACEHOLDER_REGEX = /(?:\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}|\{([a-zA-Z_][a-zA-Z0-9_]*)\})/g;

let pdfjsPromise: Promise<any> | null = null;

function ensurePdfjsGlobals() {
  const g = globalThis as any;

  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;

      constructor(init?: any) {
        if (Array.isArray(init) && init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
          this.m11 = init[0]; this.m12 = init[1];
          this.m21 = init[2]; this.m22 = init[3];
          this.m41 = init[4]; this.m42 = init[5];
          this.isIdentity =
            init[0] === 1 && init[1] === 0 && init[2] === 0 &&
            init[3] === 1 && init[4] === 0 && init[5] === 0;
        }
      }

      multiply(other: any) {
        const r = new (g.DOMMatrix as any)();
        r.a = this.a * other.a + this.c * other.b;
        r.b = this.b * other.a + this.d * other.b;
        r.c = this.a * other.c + this.c * other.d;
        r.d = this.b * other.c + this.d * other.d;
        r.e = this.a * other.e + this.c * other.f + this.e;
        r.f = this.b * other.e + this.d * other.f + this.f;
        return r;
      }

      multiplySelf(other: any) { Object.assign(this, this.multiply(other)); return this; }

      inverse() {
        const det = this.a * this.d - this.b * this.c;
        const r = new (g.DOMMatrix as any)();
        if (det === 0) return r;
        r.a = this.d / det;
        r.b = -this.b / det;
        r.c = -this.c / det;
        r.d = this.a / det;
        r.e = (this.c * this.f - this.d * this.e) / det;
        r.f = (this.b * this.e - this.a * this.f) / det;
        return r;
      }

      invertSelf() { Object.assign(this, this.inverse()); return this; }

      translate(tx = 0, ty = 0) {
        const m = new (g.DOMMatrix as any)([1, 0, 0, 1, tx, ty]);
        return this.multiply(m);
      }
      translateSelf(tx = 0, ty = 0) { Object.assign(this, this.translate(tx, ty)); return this; }

      scale(sx = 1, sy = sx) {
        const m = new (g.DOMMatrix as any)([sx, 0, 0, sy, 0, 0]);
        return this.multiply(m);
      }
      scaleSelf(sx = 1, sy = sx) { Object.assign(this, this.scale(sx, sy)); return this; }

      rotate(deg = 0) {
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const m = new (g.DOMMatrix as any)([cos, sin, -sin, cos, 0, 0]);
        return this.multiply(m);
      }
      rotateSelf(deg = 0) { Object.assign(this, this.rotate(deg)); return this; }

      transformPoint(p: { x: number; y: number }) {
        return {
          x: this.a * p.x + this.c * p.y + this.e,
          y: this.b * p.x + this.d * p.y + this.f,
          z: 0,
          w: 1,
        };
      }
    };
  }

  if (typeof g.Path2D === "undefined") {
    g.Path2D = class Path2D {
      addPath() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
      rect() {}
      arc() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
    };
  }

  if (typeof g.ImageData === "undefined") {
    g.ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      colorSpace = "srgb";
      constructor(...args: any[]) {
        if (args[0] instanceof Uint8ClampedArray) {
          this.data = args[0];
          this.width = args[1];
          this.height = args[2] ?? args[0].length / 4 / args[1];
        } else {
          this.width = args[0];
          this.height = args[1];
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
      }
    };
  }
}

function loadPdfjs() {
  if (!pdfjsPromise) {
    ensurePdfjsGlobals();
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsPromise;
}

export async function scanPlaceholders(pdfBytes: Buffer): Promise<PlaceholderMap> {
  const pdfjsLib = await loadPdfjs();

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

    const sorted = [...items].sort((a, b) => {
      const ya = a.transform[5];
      const yb = b.transform[5];
      if (Math.abs(ya - yb) > 2) return yb - ya;
      return a.transform[4] - b.transform[4];
    });

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
      let combined = "";
      const itemByChar: any[] = [];
      for (const item of line.items) {
        const text: string = item.str || "";
        for (let c = 0; c < text.length; c++) {
          itemByChar.push(item);
        }
        combined += text;
      }

      PLACEHOLDER_REGEX.lastIndex = 0;
      let match;
      while ((match = PLACEHOLDER_REGEX.exec(combined)) !== null) {
        const rawKey = match[1] ?? match[2];
        if (!rawKey) continue;
        const key = rawKey.toUpperCase();
        if (result[key]) continue;

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
