import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mocking style as permissions.test.ts: keep these fast/hermetic and
// avoid pulling real auth. We do NOT mock @/lib/permissions — the real
// requireAssetAccess/canSeeContactDetails are what we're exercising here.
const accessFindUnique = vi.fn();
const trackingFindUnique = vi.fn();
const getServerSession = vi.fn();

vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: {
    assetViewerAccess: { findUnique: (...a: unknown[]) => accessFindUnique(...a) },
    assetCompanyTracking: { findUnique: (...a: unknown[]) => trackingFindUnique(...a) },
  },
}));

import { loadTrackingTimeline } from "./timeline";

function fixtureTracking() {
  return {
    id: "t1",
    assetId: "a1",
    company: { name: "Acme" },
    asset: { id: "a1", title: "Asset" },
    stageStatuses: [],
    stageHistory: [
      {
        id: "h1",
        changedBy: { name: "Staff Person" },
        stage: { label: "NDA" },
        fieldName: "status",
        oldValue: null,
        newValue: "DONE",
        createdAt: new Date("2026-01-01"),
      },
    ],
    comments: [
      {
        id: "c1",
        author: { name: "Staff Person" },
        body: "hi",
        createdAt: new Date("2026-01-01"),
      },
    ],
    documents: [
      {
        id: "d1",
        uploadedBy: { name: "Staff Person" },
        stage: { label: "NDA" },
        fileName: "nda.pdf",
        status: "SIGNED",
        createdAt: new Date("2026-01-01"),
        signedAt: new Date("2026-01-02"),
        signedByName: "Investor Jane",
        signedByEmail: "jane@investor.example",
        rejectedAt: null,
      },
    ],
  };
}

beforeEach(() => {
  accessFindUnique.mockReset();
  trackingFindUnique.mockReset();
  getServerSession.mockReset();
});

describe("loadTrackingTimeline", () => {
  it("VIEWER without an access row is denied and the tracking is never queried", async () => {
    accessFindUnique.mockResolvedValue(null);

    const result = await loadTrackingTimeline({ id: "u1", role: "VIEWER" }, "a1", "t1");

    expect(result).toBeNull();
    expect(trackingFindUnique).not.toHaveBeenCalled();
  });

  it("EDITOR is allowed and sees real names", async () => {
    trackingFindUnique.mockResolvedValue(fixtureTracking());

    const result = await loadTrackingTimeline({ id: "u1", role: "EDITOR" }, "a1", "t1");

    expect(result).not.toBeNull();
    expect(result!.events.some((e) => e.userName === "Staff Person")).toBe(true);
    const signedEvent = result!.events.find((e) => e.id === "doc-signed-d1");
    expect(signedEvent?.description).toContain("jane@investor.example");
    expect(accessFindUnique).not.toHaveBeenCalled();
  });

  it("VIEWER with an access row is allowed but staff and signer identities are stripped", async () => {
    accessFindUnique.mockResolvedValue({ id: "g1" });
    trackingFindUnique.mockResolvedValue(fixtureTracking());

    const result = await loadTrackingTimeline({ id: "u1", role: "VIEWER" }, "a1", "t1");

    expect(result).not.toBeNull();
    expect(result!.events.some((e) => e.userName === "Staff Person")).toBe(false);
    expect(
      result!.events.some(
        (e) =>
          e.description?.includes("Investor Jane") ||
          e.description?.includes("jane@investor.example") ||
          e.title.includes("Investor Jane") ||
          e.title.includes("jane@investor.example")
      )
    ).toBe(false);
    expect(result!.events.some((e) => e.userName === "Team member")).toBe(true);
  });

  it("a tracking that belongs to a different asset is not found", async () => {
    trackingFindUnique.mockResolvedValue(fixtureTracking());

    const result = await loadTrackingTimeline({ id: "u1", role: "EDITOR" }, "other", "t1");

    expect(result).toBeNull();
  });
});
