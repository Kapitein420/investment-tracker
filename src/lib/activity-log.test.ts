import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mocking style as timeline.test.ts: mock the two seams (Prisma, IP
// lookup) and exercise the real function.
const activityLogCreate = vi.fn();
const getClientIp = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { activityLog: { create: (...a: unknown[]) => activityLogCreate(...a) } },
}));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: (...a: unknown[]) => getClientIp(...a),
}));

import { logDownloadAccess } from "./activity-log";

beforeEach(() => {
  activityLogCreate.mockReset();
  getClientIp.mockReset().mockResolvedValue("203.0.113.5");
});

describe("logDownloadAccess", () => {
  it("writes an ActivityLog row with role and IP folded into metadata", async () => {
    activityLogCreate.mockResolvedValue({});

    await logDownloadAccess({
      action: "DOCUMENT_ACCESSED",
      entityType: "Document",
      entityId: "doc-1",
      userId: "user-1",
      role: "VIEWER" as any,
      metadata: { documentId: "doc-1", storagePath: "x/y.pdf" },
    });

    expect(activityLogCreate).toHaveBeenCalledTimes(1);
    const { data } = activityLogCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      entityType: "Document",
      entityId: "doc-1",
      action: "DOCUMENT_ACCESSED",
      userId: "user-1",
    });
    expect(data.metadata).toMatchObject({
      documentId: "doc-1",
      storagePath: "x/y.pdf",
      role: "VIEWER",
      ip: "203.0.113.5",
    });
  });

  it("never throws when the write fails — a logging failure must not block a download", async () => {
    activityLogCreate.mockRejectedValue(new Error("db down"));

    await expect(
      logDownloadAccess({
        action: "CONTENT_ACCESSED",
        entityType: "AssetContent",
        entityId: "c1",
        userId: "u1",
        role: "ADMIN" as any,
        metadata: {},
      })
    ).resolves.toBeUndefined();
  });
});
