import { describe, it, expect, beforeAll } from "vitest";
import { unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from "./unsubscribe";

beforeAll(() => {
  // unsubscribeToken/verify need a signing secret; auth.ts throws the same
  // way at runtime if this is missing, so tests set a fixed one rather than
  // depending on .env being loaded.
  process.env.NEXTAUTH_SECRET ??= "test-secret-for-unsubscribe-tests";
  process.env.NEXTAUTH_URL ??= "https://portal.example.com";
});

describe("unsubscribeToken / verifyUnsubscribeToken", () => {
  it("round-trips: a token minted for an email verifies against that email", () => {
    const token = unsubscribeToken("investor@example.com");
    expect(verifyUnsubscribeToken("investor@example.com", token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = unsubscribeToken("investor@example.com");
    const tampered = token.slice(0, -1) + (token.at(-1) === "0" ? "1" : "0");
    expect(verifyUnsubscribeToken("investor@example.com", tampered)).toBe(false);
  });

  it("rejects a token minted for a different email", () => {
    const token = unsubscribeToken("investor@example.com");
    expect(verifyUnsubscribeToken("someone-else@example.com", token)).toBe(false);
  });

  it("rejects garbage / non-hex input without throwing", () => {
    expect(verifyUnsubscribeToken("investor@example.com", "not-a-token")).toBe(false);
    expect(verifyUnsubscribeToken("investor@example.com", "")).toBe(false);
  });

  it("normalises case and surrounding whitespace before signing", () => {
    const token = unsubscribeToken("  Investor@Example.com  ");
    expect(verifyUnsubscribeToken("investor@example.com", token)).toBe(true);
    expect(unsubscribeToken("investor@example.com")).toBe(token);
  });
});

describe("unsubscribeUrl", () => {
  it("embeds the normalised email and a verifiable token", () => {
    const url = unsubscribeUrl("  Investor@Example.com  ");
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/unsubscribe");
    const email = parsed.searchParams.get("e")!;
    const token = parsed.searchParams.get("t")!;
    expect(email).toBe("investor@example.com");
    expect(verifyUnsubscribeToken(email, token)).toBe(true);
  });
});
