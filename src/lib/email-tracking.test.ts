import { describe, it, expect } from "vitest";
import { trackingOptions, normalise, TRACKING_NOTICE_VERSION } from "./email-tracking";

// hasTrackingConsent / grantTrackingConsent / revokeTrackingConsent hit
// Prisma directly and aren't mocked here — same call as unsubscribe.ts's
// isSuppressed/suppressEmail, which the existing tests also leave untested.
// Verified against a real docker Postgres instead (see PR description).

describe("normalise", () => {
  it("trims and lowercases", () => {
    expect(normalise("  Investor@Example.com  ")).toBe("investor@example.com");
  });

  it("is idempotent", () => {
    const once = normalise("Investor@Example.com");
    expect(normalise(once)).toBe(once);
  });
});

describe("trackingOptions", () => {
  it("returns yes for every flag when consented", () => {
    expect(trackingOptions(true)).toEqual({
      "o:tracking": "yes",
      "o:tracking-opens": "yes",
      "o:tracking-clicks": "yes",
    });
  });

  it("returns no for every flag when not consented — the default", () => {
    expect(trackingOptions(false)).toEqual({
      "o:tracking": "no",
      "o:tracking-opens": "no",
      "o:tracking-clicks": "no",
    });
  });
});

describe("TRACKING_NOTICE_VERSION", () => {
  it("is a non-empty version string", () => {
    expect(TRACKING_NOTICE_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
  });
});
