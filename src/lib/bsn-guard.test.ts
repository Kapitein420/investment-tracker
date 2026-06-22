import { describe, it, expect } from "vitest";
import { containsBSN, noBsn } from "@/lib/validators";

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
