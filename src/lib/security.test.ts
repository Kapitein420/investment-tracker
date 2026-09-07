import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { BCRYPT_COST, hashUnusablePassword } from "./security";

describe("hashUnusablePassword", () => {
  it("returns a real bcrypt hash at the configured cost", async () => {
    const hash = await hashUnusablePassword();
    expect(hash).toMatch(new RegExp(`^\\$2[aby]\\$${BCRYPT_COST}\\$`));
  });

  it("never produces the same value twice", async () => {
    const [a, b] = await Promise.all([hashUnusablePassword(), hashUnusablePassword()]);
    expect(a).not.toBe(b);
  });

  it("does not match the empty string or any obvious sentinel", async () => {
    const hash = await hashUnusablePassword();
    for (const guess of ["", " ", "password", "null", "undefined"]) {
      expect(await bcrypt.compare(guess, hash)).toBe(false);
    }
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
