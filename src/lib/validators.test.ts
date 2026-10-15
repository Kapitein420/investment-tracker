import { describe, it, expect } from "vitest";
import { submitOfferSchema } from "@/lib/validators";

describe("submitOfferSchema (investor NBO offer, G8 offer-letter parity)", () => {
  it("accepts a PDF with attestation ticked", () => {
    const result = submitOfferSchema.safeParse({ hasFile: true, attestation: true });
    expect(result.success).toBe(true);
  });

  it("requires a PDF: rejects a submission with no file", () => {
    const result = submitOfferSchema.safeParse({ hasFile: false, attestation: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/non-binding offer letter/i);
    }
  });

  it("rejects a file submission missing attestation", () => {
    const result = submitOfferSchema.safeParse({ hasFile: true });
    expect(result.success).toBe(false);
  });

  it("rejects a file submission with attestation explicitly false", () => {
    const result = submitOfferSchema.safeParse({ hasFile: true, attestation: false });
    expect(result.success).toBe(false);
  });

  it("no longer takes an amount or currency", () => {
    // Stray fields from an old client are ignored, not required.
    const result = submitOfferSchema.safeParse({
      hasFile: true,
      attestation: true,
      amount: 1_000_000,
      currency: "EUR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ hasFile: true, attestation: true });
    }
  });
});
