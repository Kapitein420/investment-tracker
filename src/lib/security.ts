import { randomInt } from "crypto";

/**
 * Centralised bcrypt work factor. Raised from the previous value of 10 —
 * cost 12 is the current (2026) common floor for server-side hashing.
 * Existing hashes keep working; they are upgraded opportunistically the
 * next time a user changes or is issued a password.
 */
export const BCRYPT_COST = 12;

/**
 * Cryptographically-secure password generator for system-issued
 * credentials (invites, admin resets, self-serve resets).
 *
 * Uses crypto.randomInt (CSPRNG) instead of Math.random — these strings
 * are the entire authentication secret for an investor account, so a
 * predictable PRNG would make issued passwords guessable. The alphabet
 * deliberately omits ambiguous characters (0/O, 1/l/I) so the value is
 * readable when copied out of an email.
 */
export function generateSecurePassword(length = 16): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[randomInt(0, chars.length)];
  }
  return out;
}
