import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

/**
 * Centralised bcrypt work factor. Raised from the previous value of 10 —
 * cost 12 is the current (2026) common floor for server-side hashing.
 * Existing hashes keep working; they are upgraded opportunistically the
 * next time a user changes or is issued a password.
 */
export const BCRYPT_COST = 12;

/**
 * Hash of 32 random bytes nobody ever sees — a User row that can only be
 * reached through a set-password link (invite, /request-access bootstrap).
 *
 * `passwordHash` is NOT NULL and the login path bcrypt-compares against it
 * unconditionally, so the column needs a real hash rather than a sentinel:
 * anything recognisable would be a value an attacker could try to submit.
 */
export async function hashUnusablePassword(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString("base64url"), BCRYPT_COST);
}
