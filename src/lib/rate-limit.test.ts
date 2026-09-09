import { describe, it, expect, afterEach } from "vitest";
import { emailLinkPageCap } from "@/lib/rate-limit";

describe("emailLinkPageCap", () => {
  const original = process.env.AUTH_LIMIT_BOOST;

  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_LIMIT_BOOST;
    else process.env.AUTH_LIMIT_BOOST = original;
  });

  it("defaults to 30/min when launch mode is off", () => {
    delete process.env.AUTH_LIMIT_BOOST;
    expect(emailLinkPageCap()).toBe(30);
  });

  it("triples to 90/min when launch mode is on", () => {
    process.env.AUTH_LIMIT_BOOST = "true";
    expect(emailLinkPageCap()).toBe(90);
  });

  it("only honours the exact string 'true', matching the auth path", () => {
    for (const v of ["1", "TRUE", "yes", ""]) {
      process.env.AUTH_LIMIT_BOOST = v;
      expect(emailLinkPageCap()).toBe(30);
    }
  });

  it("is read per call, so a mid-window toggle takes effect on redeploy", () => {
    delete process.env.AUTH_LIMIT_BOOST;
    expect(emailLinkPageCap()).toBe(30);
    process.env.AUTH_LIMIT_BOOST = "true";
    expect(emailLinkPageCap()).toBe(90);
  });
});
