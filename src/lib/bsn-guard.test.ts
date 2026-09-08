import { describe, it, expect } from "vitest";
import { containsBSN, noBsn, containsIban, containsDutchIdNumber, createCommentSchema } from "@/lib/validators";

describe("BSN guard (UAVG Art. 46)", () => {
  it("detects a number passing the elfproef (valid BSN)", () => {
    // 111222333 passes the 11-test; 123456789 does not.
    expect(containsBSN("klant BSN 111222333 graag verwerken")).toBe(true);
    expect(containsBSN("ref 123456789")).toBe(false);
  });

  it("ignores empty / non-BSN text", () => {
    expect(containsBSN("")).toBe(false);
    expect(containsBSN(null)).toBe(false);
    expect(containsBSN(undefined)).toBe(false);
    expect(containsBSN("call me on +31 6 1234 5678")).toBe(false);
    expect(containsBSN("bid was 950000 EUR")).toBe(false);
  });

  it("noBsn refinement returns false only when a BSN is present", () => {
    expect(noBsn("ordinary note")).toBe(true);
    expect(noBsn(undefined)).toBe(true);
    expect(noBsn("BSN 111222333")).toBe(false);
  });
});

describe("IBAN guard (UAVG Art. 46)", () => {
  it("detects a valid IBAN, with or without spaces", () => {
    expect(containsIban("wire to NL91ABNA0417164300 please")).toBe(true);
    expect(containsIban("wire to NL91 ABNA 0417 1643 00 please")).toBe(true);
  });

  it("does not flag an IBAN-shaped lookalike with a bad checksum", () => {
    expect(containsIban("ref NL91ABNA0417164301")).toBe(false);
  });

  it("ignores empty / non-IBAN text", () => {
    expect(containsIban("")).toBe(false);
    expect(containsIban(null)).toBe(false);
    expect(containsIban(undefined)).toBe(false);
  });
});

describe("Dutch passport/ID document number guard (UAVG Art. 46)", () => {
  it("flags a plausible ID number only when a cue word is nearby", () => {
    expect(containsDutchIdNumber("paspoort nummer NX1234567 bijgevoegd")).toBe(true);
    expect(containsDutchIdNumber("passport NX1234567 attached")).toBe(true);
  });

  it("does not flag the same shape without a cue word (e.g. a deal code)", () => {
    expect(containsDutchIdNumber("deal code NX1234567 assigned")).toBe(false);
  });

  it("does not flag a plain 9-character asset code", () => {
    expect(containsDutchIdNumber("asset code AB1234567")).toBe(false);
  });
});

describe("noSensitiveIds refinement chain on free-text fields", () => {
  it("reports the BSN message first when a comment mixes a BSN and an IBAN", () => {
    const result = createCommentSchema.safeParse({
      trackingId: "t1",
      body: "BSN 111222333, IBAN NL91ABNA0417164300",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/BSN/);
    }
  });

  it("rejects a comment containing only an IBAN", () => {
    const result = createCommentSchema.safeParse({
      trackingId: "t1",
      body: "please transfer to NL91ABNA0417164300",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/IBAN/);
    }
  });
});
