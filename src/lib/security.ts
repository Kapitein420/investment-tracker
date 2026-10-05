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

// 31 symbols; no 0/O/1/I/L so it survives being read off a screen and typed
// on a phone.
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 12 CSPRNG symbols (~59 bits) in groups of four, e.g. `K7QX-M2PV-9RTD`. */
export function generatePassword(): string {
  const out: string[] = [];
  while (out.length < 12) {
    // Reject bytes >= 248 so the modulo stays unbiased (248 = 31 * 8).
    for (const b of randomBytes(24)) {
      if (b < 248 && out.length < 12) out.push(PASSWORD_ALPHABET[b % 31]);
    }
  }
  return [out.slice(0, 4), out.slice(4, 8), out.slice(8, 12)]
    .map((g) => g.join(""))
    .join("-");
}
