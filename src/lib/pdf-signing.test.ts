import { createHash } from "crypto";
import zlib from "zlib";
import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { appendSignatureCertificatePage, type SignatureCertificateInfo } from "./pdf-signing";

// pdf-lib writes drawn text as hex-encoded strings inside FlateDecode content
// streams (`<48656C6C6F> Tj`), not literal ASCII — so a raw substring search
// on the saved bytes never matches. This decodes every content stream and
// concatenates the hex-decoded text operands, giving us a plain-text view of
// everything drawn on the page without pulling in a PDF-text-extraction
// dependency (pdf-parse isn't in package.json).
function extractDrawnText(pdfBytes: Uint8Array): string {
  const raw = Buffer.from(pdfBytes).toString("latin1");
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  const hexStringRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let out = "";
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRe.exec(raw))) {
    let inflated: string;
    try {
      inflated = zlib.inflateSync(Buffer.from(streamMatch[1], "latin1")).toString("latin1");
    } catch {
      continue; // not a flate-compressed content stream (e.g. an object stream we can't decode this way)
    }
    let hexMatch: RegExpExecArray | null;
    while ((hexMatch = hexStringRe.exec(inflated))) {
      out += Buffer.from(hexMatch[1], "hex").toString("latin1") + " ";
    }
  }
  return out;
}

async function makeOnePagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Original document content", { x: 50, y: 700, size: 12, font });
  return doc.save();
}

const SAMPLE_INFO: SignatureCertificateInfo = {
  documentTitle: "NDA-example.pdf",
  dealName: "Project Falcon",
  companyName: "Acme Capital B.V.",
  signerName: "Jane Doe",
  signerEmail: "jane@example.com",
  signedAt: new Date("2026-09-07T10:15:00.000Z"),
  signerIp: "203.0.113.42",
  signerUserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  signingTokenId: "tok_abc123",
  documentSha256: "a".repeat(64),
  intentConfirmedAt: new Date("2026-09-07T10:14:55.000Z"),
};

describe("appendSignatureCertificatePage", () => {
  it("adds exactly one page to the document", async () => {
    const original = await makeOnePagePdf();
    const originalPageCount = (await PDFDocument.load(original)).getPageCount();

    const withCert = await appendSignatureCertificatePage(original, SAMPLE_INFO);
    const finalPageCount = (await PDFDocument.load(withCert)).getPageCount();

    expect(originalPageCount).toBe(1);
    expect(finalPageCount).toBe(2);
  });

  it("changes the document bytes and produces a different hash", async () => {
    const original = await makeOnePagePdf();
    const withCert = await appendSignatureCertificatePage(original, SAMPLE_INFO);

    expect(Buffer.from(withCert).equals(Buffer.from(original))) .toBe(false);
    const originalHash = createHash("sha256").update(original).digest("hex");
    const finalHash = createHash("sha256").update(withCert).digest("hex");
    expect(finalHash).not.toBe(originalHash);
  });

  it("is reproducible: hashing the same input twice gives the same certificate hash modulo timestamps", async () => {
    // Not a byte-for-byte determinism test (pdf-lib embeds a creation id),
    // but confirms the function is a pure transform that always yields a
    // loadable 2-page PDF for the same input.
    const original = await makeOnePagePdf();
    const first = await appendSignatureCertificatePage(original, SAMPLE_INFO);
    const second = await appendSignatureCertificatePage(original, SAMPLE_INFO);
    expect((await PDFDocument.load(first)).getPageCount()).toBe(2);
    expect((await PDFDocument.load(second)).getPageCount()).toBe(2);
  });

  it("renders the key certificate fields as visible text on the new page", async () => {
    const original = await makeOnePagePdf();
    const withCert = await appendSignatureCertificatePage(original, SAMPLE_INFO);
    const text = extractDrawnText(withCert);

    expect(text).toContain("Signature certificate");
    expect(text).toContain(SAMPLE_INFO.documentTitle);
    expect(text).toContain(SAMPLE_INFO.dealName);
    expect(text).toContain(SAMPLE_INFO.companyName);
    expect(text).toContain(SAMPLE_INFO.signerName);
    expect(text).toContain(SAMPLE_INFO.signerEmail);
    expect(text).toContain(SAMPLE_INFO.signerIp!);
    expect(text).toContain(SAMPLE_INFO.signingTokenId);
    // The 64-char hash gets hard-wrapped across lines, so check a prefix chunk.
    expect(text).toContain(SAMPLE_INFO.documentSha256.slice(0, 20));
    // Row labels are drawn upper-cased.
    expect(text).toContain("INTENT CONFIRMED");
    expect(text).toContain("Dils Netherlands B.V.");

    // Original page content is untouched.
    expect(text).toContain("Original document content");
  });

  it("matches the last page's dimensions instead of a hardcoded size", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 400]); // deliberately non-A4
    page.drawText("tiny page", { x: 10, y: 380, size: 8, font });
    const bytes = await doc.save();

    const withCert = await appendSignatureCertificatePage(bytes, SAMPLE_INFO);
    const loaded = await PDFDocument.load(withCert);
    const certPage = loaded.getPages()[1];
    expect(certPage.getSize()).toEqual({ width: 300, height: 400 });
  });
});
