import { describe, it, expect, vi, beforeEach } from "vitest";

// Guards G10: getSignedContentUrl used to log CONTENT_ACCESSED only for
// INVESTOR; every role now logs, and a storagePath that resolves to a real
// Document (not AssetContent) now logs DOCUMENT_ACCESSED. Mocks every seam
// (permissions, Prisma, storage, activity-log) and exercises the real
// function — same style as timeline.test.ts.
const requireUser = vi.fn();
const assetContentFindFirst = vi.fn();
const documentFindFirst = vi.fn();
const getSignedUrl = vi.fn();
const logDownloadAccess = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
  requireRole: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    assetContent: { findFirst: (...a: unknown[]) => assetContentFindFirst(...a) },
    document: { findFirst: (...a: unknown[]) => documentFindFirst(...a) },
  },
}));
vi.mock("@/lib/supabase-storage", () => ({
  getSignedUrl: (...a: unknown[]) => getSignedUrl(...a),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  downloadFile: vi.fn(),
  createSignedUploadUrl: vi.fn(),
}));
vi.mock("@/lib/pdf-placeholder-scan", () => ({ scanPlaceholders: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/activity-log", () => ({
  logDownloadAccess: (...a: unknown[]) => logDownloadAccess(...a),
}));

import { getSignedContentUrl } from "./content-actions";

beforeEach(() => {
  requireUser.mockReset();
  assetContentFindFirst.mockReset();
  documentFindFirst.mockReset();
  getSignedUrl.mockReset().mockResolvedValue("https://signed.example/url");
  logDownloadAccess.mockReset();
});

describe("getSignedContentUrl", () => {
  it("logs CONTENT_ACCESSED for a non-investor role (ADMIN), not just INVESTOR", async () => {
    requireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    assetContentFindFirst.mockResolvedValue({ id: "c1", assetId: "a1", stageKey: "im" });

    const url = await getSignedContentUrl("path/to/im.pdf");

    expect(url).toBe("https://signed.example/url");
    expect(logDownloadAccess).toHaveBeenCalledTimes(1);
    expect(logDownloadAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONTENT_ACCESSED",
        entityType: "AssetContent",
        entityId: "c1",
        userId: "admin-1",
        role: "ADMIN",
        metadata: expect.objectContaining({ trackingId: null }),
      })
    );
  });

  it("logs DOCUMENT_ACCESSED when the storage path resolves to a Document, not AssetContent", async () => {
    requireUser.mockResolvedValue({ id: "editor-1", role: "EDITOR" });
    assetContentFindFirst.mockResolvedValue(null);
    documentFindFirst.mockResolvedValue({
      id: "d1",
      trackingId: "t1",
      fileName: "rentroll.pdf",
      tracking: { assetId: "a1", companyId: "co1" },
    });

    await getSignedContentUrl("path/to/rentroll.pdf");

    expect(logDownloadAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DOCUMENT_ACCESSED",
        entityType: "Document",
        entityId: "d1",
        userId: "editor-1",
        role: "EDITOR",
      })
    );
  });
});
