import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mocking style as purge.test.ts: stub the Prisma model rather than
// hit a real database.
const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    termsAcceptance: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      upsert: (...a: unknown[]) => upsert(...a),
    },
  },
}));

import { hasAcceptedCurrentTerms, recordTermsAcceptance, TERMS_VERSION, TERMS_URL } from "./terms";

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset().mockResolvedValue({});
});

describe("TERMS_VERSION / TERMS_URL", () => {
  it("are non-empty and point at the existing algemene voorwaarden page", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}$/);
    expect(TERMS_URL).toBe("https://dils.nl/algemene-voorwaarden/");
  });
});

describe("hasAcceptedCurrentTerms", () => {
  it("returns true when a row exists for the current version", async () => {
    findUnique.mockResolvedValue({ id: "ta_1" });
    const result = await hasAcceptedCurrentTerms("user_1");
    expect(result).toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_termsVersion: { userId: "user_1", termsVersion: TERMS_VERSION } },
      select: { id: true },
    });
  });

  it("returns false when no row exists", async () => {
    findUnique.mockResolvedValue(null);
    expect(await hasAcceptedCurrentTerms("user_2")).toBe(false);
  });
});

describe("recordTermsAcceptance", () => {
  it("upserts on the (userId, termsVersion) pair with ip/userAgent", async () => {
    await recordTermsAcceptance({ userId: "user_1", ip: "1.2.3.4", userAgent: "TestAgent/1.0" });

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      userId_termsVersion: { userId: "user_1", termsVersion: TERMS_VERSION },
    });
    expect(call.create).toMatchObject({
      userId: "user_1",
      termsVersion: TERMS_VERSION,
      ip: "1.2.3.4",
      userAgent: "TestAgent/1.0",
    });
    expect(call.update).toMatchObject({ ip: "1.2.3.4", userAgent: "TestAgent/1.0" });
  });

  it("defaults ip/userAgent to null when omitted", async () => {
    await recordTermsAcceptance({ userId: "user_3" });
    const call = upsert.mock.calls[0][0];
    expect(call.create.ip).toBeNull();
    expect(call.create.userAgent).toBeNull();
  });
});
