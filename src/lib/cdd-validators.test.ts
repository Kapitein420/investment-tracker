import { describe, it, expect } from "vitest";
import { setCompanyCddSchema } from "@/lib/validators";

describe("setCompanyCddSchema (Wwft / CDD attestation, G7)", () => {
  const base = {
    companyId: "c1",
    cddStatus: "IN_PROGRESS" as const,
    cddNote: null,
    sanctionsScreened: false,
  };

  it("accepts each of the four status values", () => {
    for (const cddStatus of ["NOT_STARTED", "IN_PROGRESS", "CLEARED", "ESCALATED"] as const) {
      expect(setCompanyCddSchema.safeParse({ ...base, cddStatus }).success).toBe(true);
    }
  });

  it("rejects a status outside the enum", () => {
    const result = setCompanyCddSchema.safeParse({ ...base, cddStatus: "DONE" });
    expect(result.success).toBe(false);
  });

  it("requires companyId and sanctionsScreened", () => {
    expect(setCompanyCddSchema.safeParse({ ...base, companyId: "" }).success).toBe(false);
    expect(
      setCompanyCddSchema.safeParse({
        companyId: "c1",
        cddStatus: "CLEARED",
        cddNote: null,
      }).success
    ).toBe(false);
  });

  it("allows a missing or null note", () => {
    expect(setCompanyCddSchema.safeParse({ ...base, cddNote: undefined }).success).toBe(true);
    expect(setCompanyCddSchema.safeParse({ ...base, cddNote: null }).success).toBe(true);
  });

  it("caps the note at 500 characters", () => {
    expect(setCompanyCddSchema.safeParse({ ...base, cddNote: "a".repeat(500) }).success).toBe(true);
    expect(setCompanyCddSchema.safeParse({ ...base, cddNote: "a".repeat(501) }).success).toBe(false);
  });

  it("rejects a BSN in the note (UAVG Art. 46 guard)", () => {
    // 111222333 passes the elfproef (valid BSN); 123456789 does not.
    const result = setCompanyCddSchema.safeParse({
      ...base,
      cddNote: "KYC ref, BSN 111222333 on file",
    });
    expect(result.success).toBe(false);

    expect(
      setCompanyCddSchema.safeParse({ ...base, cddNote: "KYC case ref 123456789" }).success
    ).toBe(true);
  });
});
