import { describe, it, expect } from "vitest";
import { submitOfferSchema } from "@/lib/validators";

describe("submitOfferSchema (investor NBO offer, G8 offer-letter parity)", () => {
  const base = { amount: 1_000_000, currency: "EUR" as const };

  it("accepts an amount-only submission with no attestation", () => {
    const result = submitOfferSchema.safeParse({ ...base, hasFile: false });
    expect(result.success).toBe(true);
  });

  it("ignores a stray attestation field on the no-file branch", () => {
    const result = submitOfferSchema.safeParse({
      ...base,
      hasFile: false,
      attestation: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a file submission missing attestation", () => {
    const result = submitOfferSchema.safeParse({ ...base, hasFile: true });
    expect(result.success).toBe(false);
  });

  it("rejects a file submission with attestation explicitly false", () => {
    const result = submitOfferSchema.safeParse({
      ...base,
      hasFile: true,
      attestation: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a file submission with attestation ticked", () => {
    const result = submitOfferSchema.safeParse({
      ...base,
      hasFile: true,
      attestation: true,
    });
    expect(result.success).toBe(true);
  });

  it("still enforces the shared amount/currency rules on both branches", () => {
    expect(
      submitOfferSchema.safeParse({ hasFile: false, amount: -5, currency: "EUR" }).success
    ).toBe(false);
    expect(
      submitOfferSchema.safeParse({
        hasFile: true,
        attestation: true,
        amount: 100,
        currency: "JPY",
      }).success
    ).toBe(false);
  });
});
