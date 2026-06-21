import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the heavy/IO collaborators so these stay fast unit tests. authOptions
// is only used as an opaque handle; prisma + getServerSession are the seams
// we drive.
const findUnique = vi.fn();
const getServerSession = vi.fn();

vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: { assetViewerAccess: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

import { requireRole, requireAssetAccess } from "./permissions";

function session(role: string) {
  return { user: { id: "u1", role, email: "x@y.z", name: "X", companyId: null } };
}

beforeEach(() => {
  findUnique.mockReset();
  getServerSession.mockReset();
});

describe("requireRole hierarchy", () => {
  it("allows a role at or above the minimum", async () => {
    getServerSession.mockResolvedValue(session("ADMIN"));
    await expect(requireRole("EDITOR")).resolves.toMatchObject({ role: "ADMIN" });

    getServerSession.mockResolvedValue(session("EDITOR"));
    await expect(requireRole("EDITOR")).resolves.toMatchObject({ role: "EDITOR" });
  });

  it("rejects a role below the minimum", async () => {
    getServerSession.mockResolvedValue(session("VIEWER"));
    await expect(requireRole("EDITOR")).rejects.toThrow("Forbidden");

    getServerSession.mockResolvedValue(session("INVESTOR"));
    await expect(requireRole("ADMIN")).rejects.toThrow("Forbidden");
  });

  it("rejects an unauthenticated request", async () => {
    getServerSession.mockResolvedValue(null);
    await expect(requireRole("VIEWER")).rejects.toThrow("Unauthorized");
  });
});

describe("requireAssetAccess (VIEWER per-asset gate)", () => {
  it("lets ADMIN/EDITOR through without touching the access table", async () => {
    await expect(requireAssetAccess("u1", "ADMIN", "a1")).resolves.toBeUndefined();
    await expect(requireAssetAccess("u1", "EDITOR", "a1")).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("allows a VIEWER that has an access row", async () => {
    findUnique.mockResolvedValue({ id: "grant1" });
    await expect(requireAssetAccess("u1", "VIEWER", "a1")).resolves.toBeUndefined();
  });

  it("forbids a VIEWER without an access row", async () => {
    findUnique.mockResolvedValue(null);
    await expect(requireAssetAccess("u1", "VIEWER", "a1")).rejects.toThrow("Forbidden");
  });

  it("forbids INVESTOR (wrong gate — they go through tracking)", async () => {
    await expect(requireAssetAccess("u1", "INVESTOR", "a1")).rejects.toThrow("Forbidden");
  });
});
