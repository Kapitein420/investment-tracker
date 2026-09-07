import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { BCRYPT_COST, generateSecurePassword } from "./security";

describe("generateSecurePassword", () => {
  it("returns the requested length (default 16)", () => {
    expect(generateSecurePassword()).toHaveLength(16);
    expect(generateSecurePassword(24)).toHaveLength(24);
  });

  it("only uses the unambiguous alphabet (no 0/O/1/l/I)", () => {
    const allowed = /^[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
    for (let i = 0; i < 50; i++) {
      expect(generateSecurePassword(32)).toMatch(allowed);
    }
  });

  it("does not repeat across many draws (CSPRNG, high entropy)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateSecurePassword());
    expect(seen.size).toBe(1000);
  });

  it("keeps the bcrypt work factor at the 2026 floor", () => {
    expect(BCRYPT_COST).toBeGreaterThanOrEqual(12);
  });
});

describe("bcrypt hash compatibility", () => {
  // A real $2a$ hash produced by bcryptjs 2.x — the seed accounts'
  // passwordHash, committed in supabase-setup.sql. Every investor password
  // in production is stored in this same format, so any bcryptjs upgrade
  // has to keep verifying it. If this test fails after a bump, that version
  // cannot read existing hashes and would lock every user out.
  const LEGACY_2A_HASH =
    "$2a$10$YGL/yDiF1rImsk8x9NCJiuzLF68SkUtvInLrI9.yF9hnyGVbaNXqC";

  it("verifies a $2a$ hash produced by bcryptjs 2.x", async () => {
    expect(await bcrypt.compare("password123", LEGACY_2A_HASH)).toBe(true);
  });

  it("still rejects the wrong password against that hash", async () => {
    expect(await bcrypt.compare("password124", LEGACY_2A_HASH)).toBe(false);
  });
});
