import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  companyContact: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn(), create: vi.fn() },
  company: { findUniqueOrThrow: vi.fn() },
}));
const membership = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/security", () => ({ hashUnusablePassword: vi.fn().mockResolvedValue("unusable-hash") }));
vi.mock("@/lib/user-companies", () => ({ ensureUserCompanyMembership: membership }));

import { ensureContactAccess } from "./contact-access";

beforeEach(() => {
  vi.clearAllMocks();
  db.companyContact.findUnique.mockResolvedValue(null);
  db.user.findFirst.mockResolvedValue(null);
  db.user.create.mockResolvedValue({ id: "u1", role: "INVESTOR" });
  db.company.findUniqueOrThrow.mockResolvedValue({ name: "AESPIRE" });
});

describe("ensureContactAccess", () => {
  it("creates the contact row, an INVESTOR account and a membership for a new person", async () => {
    const r = await ensureContactAccess({ companyId: "c1", name: " Fleur Klunder ", email: " Fleur@Aespire.EU " });

    expect(r).toEqual({ contactCreated: true, accountCreated: true });
    expect(db.companyContact.create).toHaveBeenCalledWith({
      data: { companyId: "c1", email: "fleur@aespire.eu", name: "Fleur Klunder", source: "STAFF" },
    });
    const created = db.user.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      email: "fleur@aespire.eu",
      name: "Fleur Klunder",
      role: "INVESTOR",
      companyId: "c1",
      passwordHash: "unusable-hash",
    });
    // First login must still force a password change.
    expect(created).not.toHaveProperty("passwordChangedAt");
    expect(membership).toHaveBeenCalledWith("u1", "c1");
  });

  it("falls back to the company name when no contact name is given", async () => {
    await ensureContactAccess({ companyId: "c1", email: "x@y.nl" });
    expect(db.user.create.mock.calls[0][0].data.name).toBe("AESPIRE");
  });

  it("does nothing without a usable email", async () => {
    for (const email of [undefined, null, "", "   ", "not-an-email"]) {
      const r = await ensureContactAccess({ companyId: "c1", name: "Someone", email });
      expect(r).toEqual({ contactCreated: false, accountCreated: false, skipped: "no-email" });
    }
    expect(db.companyContact.create).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("is idempotent for someone already set up", async () => {
    db.companyContact.findUnique.mockResolvedValue({ id: "cc1", name: "Fleur" });
    db.user.findFirst.mockResolvedValue({ id: "u1", role: "INVESTOR" });

    const r = await ensureContactAccess({ companyId: "c1", name: "Fleur", email: "fleur@aespire.eu" });

    expect(r).toEqual({ contactCreated: false, accountCreated: false });
    expect(db.companyContact.create).not.toHaveBeenCalled();
    expect(db.companyContact.update).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
    expect(membership).toHaveBeenCalledWith("u1", "c1");
  });

  it("backfills a missing name on an existing contact", async () => {
    db.companyContact.findUnique.mockResolvedValue({ id: "cc1", name: null });
    await ensureContactAccess({ companyId: "c1", name: "Fleur", email: "fleur@aespire.eu" });
    expect(db.companyContact.update).toHaveBeenCalledWith({ where: { id: "cc1" }, data: { name: "Fleur" } });
  });

  it("links an existing investor account to the new company instead of duplicating it", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u9", role: "INVESTOR" });
    const r = await ensureContactAccess({ companyId: "c2", name: "A", email: "a@b.nl" });
    expect(r.accountCreated).toBe(false);
    expect(db.user.create).not.toHaveBeenCalled();
    expect(membership).toHaveBeenCalledWith("u9", "c2");
  });

  it("never attaches a non-investor login to an investor company", async () => {
    db.user.findFirst.mockResolvedValue({ id: "admin1", role: "ADMIN" });
    const r = await ensureContactAccess({ companyId: "c1", name: "N", email: "n@dils.com" });
    expect(r).toEqual({ contactCreated: true, accountCreated: false, skipped: "non-investor-account" });
    expect(membership).not.toHaveBeenCalled();
  });

  it("uses the other request's account when it loses a create race", async () => {
    db.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "u2", role: "INVESTOR" });
    db.user.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    const r = await ensureContactAccess({ companyId: "c1", name: "F", email: "f@a.eu" });

    expect(r.accountCreated).toBe(false);
    expect(membership).toHaveBeenCalledWith("u2", "c1");
  });

  it("surfaces unexpected database errors", async () => {
    db.user.create.mockRejectedValue(new Error("connection reset"));
    await expect(ensureContactAccess({ companyId: "c1", name: "F", email: "f@a.eu" })).rejects.toThrow("connection reset");
  });
});
