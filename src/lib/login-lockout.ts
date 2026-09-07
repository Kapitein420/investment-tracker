/**
 * Account-lockout policy (compliance gap G9). Pure decision functions —
 * the NextAuth authorize path owns the reads and writes, this file owns the
 * arithmetic so it can be tested without standing up NextAuth or Prisma.
 *
 * Lockout sits BEHIND the existing per-email / per-IP rate limits, not
 * instead of them: the limiters throttle volume from one source, lockout
 * protects one account from a distributed guess. 10 / 15 min is the NCSC
 * baseline shape — high enough that a real investor fat-fingering a
 * password on a phone never trips it.
 */

export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isAccountLocked(
  lockedUntil: Date | null | undefined,
  now: Date = new Date()
): boolean {
  return lockedUntil != null && lockedUntil.getTime() > now.getTime();
}

export interface FailedLoginState {
  failedLoginCount: number;
  lockedUntil: Date | null;
  /** True only on the attempt that crossed the threshold, so ACCOUNT_LOCKED is logged once. */
  justLocked: boolean;
}

/**
 * Next counter state after a wrong password. Locking resets the counter:
 * `lockedUntil` is what the gate reads, so a surviving count would lock the
 * account again on the first failure after the window expires.
 */
export function nextFailedLoginState(
  failedLoginCount: number,
  now: Date = new Date()
): FailedLoginState {
  const next = failedLoginCount + 1;
  if (next >= LOCKOUT_THRESHOLD) {
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + LOCKOUT_DURATION_MS),
      justLocked: true,
    };
  }
  // Clear any stale lock from a window that has already elapsed.
  return { failedLoginCount: next, lockedUntil: null, justLocked: false };
}
