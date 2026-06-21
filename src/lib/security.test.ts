import { describe, it, expect } from "vitest";
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
