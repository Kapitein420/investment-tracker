import { afterEach, describe, expect, it, vi } from "vitest";
import { dealTeamRecipients } from "./deal-team";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("dealTeamRecipients", () => {
  it("sends to the tracking owner only, ignoring the fallback", () => {
    vi.stubEnv("DEAL_TEAM_FALLBACK_EMAIL", "fallback@dils.com");
    expect(dealTeamRecipients("owner@dils.com", "offer")).toEqual(["owner@dils.com"]);
  });

  it("falls back to the configured address when there is no owner", () => {
    vi.stubEnv("DEAL_TEAM_FALLBACK_EMAIL", "fallback@dils.com");
    expect(dealTeamRecipients(null, "offer")).toEqual(["fallback@dils.com"]);
  });

  it("accepts a comma-separated fallback list and trims it", () => {
    vi.stubEnv("DEAL_TEAM_FALLBACK_EMAIL", " a@dils.com , b@dils.com ,");
    expect(dealTeamRecipients(undefined, "offer")).toEqual(["a@dils.com", "b@dils.com"]);
  });

  it("sends nothing (and warns) when there is no owner and no fallback", () => {
    vi.stubEnv("DEAL_TEAM_FALLBACK_EMAIL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(dealTeamRecipients(null, "viewing request")).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
