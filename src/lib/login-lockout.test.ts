import { describe, it, expect } from "vitest";
import {
  LOCKOUT_DURATION_MS,
  LOCKOUT_THRESHOLD,
  isAccountLocked,
  nextFailedLoginState,
} from "./login-lockout";

const NOW = new Date("2026-09-07T12:00:00.000Z");

describe("isAccountLocked", () => {
  it("is false when never locked", () => {
    expect(isAccountLocked(null, NOW)).toBe(false);
    expect(isAccountLocked(undefined, NOW)).toBe(false);
  });

  it("is true only while the window is still open", () => {
    expect(isAccountLocked(new Date(NOW.getTime() + 1000), NOW)).toBe(true);
    expect(isAccountLocked(new Date(NOW.getTime() - 1000), NOW)).toBe(false);
    expect(isAccountLocked(NOW, NOW)).toBe(false);
  });
});

describe("nextFailedLoginState", () => {
  it("counts up without locking below the threshold", () => {
    for (let count = 0; count < LOCKOUT_THRESHOLD - 1; count++) {
      const next = nextFailedLoginState(count, NOW);
      expect(next).toEqual({
        failedLoginCount: count + 1,
        lockedUntil: null,
        justLocked: false,
      });
    }
  });

  it("locks for 15 minutes on the tenth failure and resets the counter", () => {
    const next = nextFailedLoginState(LOCKOUT_THRESHOLD - 1, NOW);
    expect(next.justLocked).toBe(true);
    expect(next.failedLoginCount).toBe(0);
    expect(next.lockedUntil?.getTime()).toBe(NOW.getTime() + LOCKOUT_DURATION_MS);
    expect(LOCKOUT_DURATION_MS).toBe(15 * 60 * 1000);
  });

  it("locks the account it just produced", () => {
    const next = nextFailedLoginState(LOCKOUT_THRESHOLD - 1, NOW);
    expect(isAccountLocked(next.lockedUntil, NOW)).toBe(true);
    expect(
      isAccountLocked(next.lockedUntil, new Date(NOW.getTime() + LOCKOUT_DURATION_MS + 1))
    ).toBe(false);
  });
});
