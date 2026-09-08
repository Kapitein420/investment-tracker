import { createHash } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mocking style as purge.test.ts / content-actions.test.ts: stub the
// Prisma + storage seams and exercise the real function. $transaction just
// invokes the callback with a tx stub whose methods mirror the top-level
// mocks, since replaceOfferDocument does all its writes inside one tx.
const documentFindMany = vi.fn();
const documentCreate = vi.fn();
const documentDeleteMany = vi.fn();
const signingTokenDeleteMany = vi.fn();
const activityLogCreate = vi.fn();
const uploadFile = vi.fn();
const deleteFile = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    document: {
      findMany: (...a: unknown[]) => documentFindMany(...a),
      create: (...a: unknown[]) => documentCreate(...a),
      deleteMany: (...a: unknown[]) => documentDeleteMany(...a),
    },
    signingToken: {
      deleteMany: (...a: unknown[]) => signingTokenDeleteMany(...a),
    },
    activityLog: {
      create: (...a: unknown[]) => activityLogCreate(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        document: { create: documentCreate, deleteMany: documentDeleteMany },
        signingToken: { deleteMany: signingTokenDeleteMany },
        activityLog: { create: activityLogCreate },
      }),
  },
}));
vi.mock("@/lib/supabase-storage", () => ({
  uploadFile: (...a: unknown[]) => uploadFile(...a),
  deleteFile: (...a: unknown[]) => deleteFile(...a),
}));

import { replaceOfferDocument } from "./offer-document";

beforeEach(() => {
  documentFindMany.mockReset().mockResolvedValue([]);
  documentCreate.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "doc-1",
    ...data,
  }));
  documentDeleteMany.mockReset().mockResolvedValue({ count: 0 });
  signingTokenDeleteMany.mockReset().mockResolvedValue({ count: 0 });
  activityLogCreate.mockReset().mockResolvedValue({});
  uploadFile.mockReset().mockResolvedValue("documents/t1/offer_123_letter.pdf");
  deleteFile.mockReset().mockResolvedValue(undefined);
});

describe("replaceOfferDocument (G8 offer-letter evidence parity)", () => {
  const buffer = Buffer.from("%PDF-1.4 fake offer letter bytes");

  it("persists pdfSha256 matching the SHA-256 of the uploaded bytes", async () => {
    const expectedHash = createHash("sha256").update(buffer).digest("hex");

    const doc = await replaceOfferDocument({
      trackingId: "t1",
      stageId: "s1",
      buffer,
      fileName: "letter.pdf",
      fileSize: buffer.length,
      mimeType: "application/pdf",
      uploadedByUserId: "u1",
      action: "OFFER_DOCUMENT_SUBMITTED",
      signedByName: "Jane Investor",
      signedByEmail: "jane@example.com",
      ip: "203.0.113.5",
      userAgent: "test-agent/1.0",
      attestedAt: new Date("2026-09-08T10:00:00Z"),
    });

    expect(doc.pdfSha256).toBe(expectedHash);
    expect(documentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pdfSha256: expectedHash,
          signedByName: "Jane Investor",
          signedByEmail: "jane@example.com",
          signerIp: "203.0.113.5",
          signerUserAgent: "test-agent/1.0",
          intentConfirmedAt: new Date("2026-09-08T10:00:00Z"),
        }),
      })
    );
  });

  it("defaults evidence fields to null for a staff-side upload with no attestation", async () => {
    const doc = await replaceOfferDocument({
      trackingId: "t1",
      stageId: "s1",
      buffer,
      fileName: "letter.pdf",
      fileSize: buffer.length,
      mimeType: "application/pdf",
      uploadedByUserId: "staff-1",
      action: "OFFER_DOCUMENT_UPLOADED",
    });

    expect(doc.pdfSha256).toBe(createHash("sha256").update(buffer).digest("hex"));
    expect(doc.signedByName).toBeNull();
    expect(doc.signedByEmail).toBeNull();
    expect(doc.signerIp).toBeNull();
    expect(doc.signerUserAgent).toBeNull();
    expect(doc.intentConfirmedAt).toBeNull();
  });
});
