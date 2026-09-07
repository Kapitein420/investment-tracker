import { describe, it, expect, vi } from "vitest";
import {
  PASSWORD_SET_TTL_MS,
  claimPasswordSetToken,
  generatePasswordSetToken,
  hashPasswordSetToken,
} from "./password-set-token";

describe("password-set token", () => {
  // Fixed vector rather than re-deriving with createHash: a golden value
  // fails if the algorithm is swapped, which re-derivation would not catch.
  it("hashes with SHA-256", () => {
    expect(hashPasswordSetToken("dils-set-password-vector")).toBe(
      "41190eab267cddc9ac6ce350adaa2651c3f70f87c629df339d0c313cc861b1bc"
    );
  });

  it("stores the digest, never the raw token", () => {
    const { token, tokenHash } = generatePasswordSetToken();
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("mints 32 bytes of URL-safe entropy", () => {
    const { token } = generatePasswordSetToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("does not repeat across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generatePasswordSetToken().token);
    expect(seen.size).toBe(1000);
  });

  it("uses the expiry each purpose is documented with", () => {
    expect(PASSWORD_SET_TTL_MS.INVITE).toBe(30 * 24 * 60 * 60 * 1000);
    expect(PASSWORD_SET_TTL_MS.RESET).toBe(60 * 60 * 1000);
    expect(PASSWORD_SET_TTL_MS.ADMIN_RESET).toBe(24 * 60 * 60 * 1000);
  });
});

describe("claimPasswordSetToken", () => {
  function txWith(count: number) {
    const updateMany = vi.fn().mockResolvedValue({ count });
    return { tx: { passwordSetToken: { updateMany } } as any, updateMany };
  }

  it("claims only unused, unexpired rows — the predicate is in the UPDATE", async () => {
    const { tx, updateMany } = txWith(1);
    await expect(claimPasswordSetToken(tx, "abc")).resolves.toBe(true);

    const where = updateMany.mock.calls[0][0].where;
    expect(where.tokenHash).toBe("abc");
    expect(where.usedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(updateMany.mock.calls[0][0].data.usedAt).toBeInstanceOf(Date);
  });

  it("loses the race when another request already claimed the row", async () => {
    const { tx } = txWith(0);
    await expect(claimPasswordSetToken(tx, "abc")).resolves.toBe(false);
  });
});
