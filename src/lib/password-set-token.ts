/**
 * One-time set-password links — the replacement for emailing plaintext
 * passwords (compliance gap G9, GDPR Art. 32 / NCSC baseline).
 *
 * The raw token only ever exists in the outbound email and in the URL the
 * recipient clicks. What we persist is its SHA-256, so a database leak
 * yields no usable link. SHA-256 without a salt or KDF is deliberate: the
 * input is 256 bits of CSPRNG output, so there is nothing to brute-force
 * and the lookup has to be a plain indexed equality match.
 */

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";

export type PasswordSetPurpose = "INVITE" | "RESET" | "ADMIN_RESET";

const MINUTE = 60 * 1000;

/**
 * How long each kind of link stays valid. INVITE matches InvestorInvite's
 * 30 days (the invite and its link expire together); RESET is short because
 * anyone who can type an email address can trigger one; ADMIN_RESET sits in
 * between so a broker can hand it over on a call the next morning.
 */
export const PASSWORD_SET_TTL_MS: Record<PasswordSetPurpose, number> = {
  INVITE: 30 * 24 * 60 * MINUTE,
  RESET: 60 * MINUTE,
  ADMIN_RESET: 24 * 60 * MINUTE,
};

/** Human-readable expiry for email copy, e.g. "30 days" / "60 minutes". */
export const PASSWORD_SET_TTL_LABEL: Record<PasswordSetPurpose, string> = {
  INVITE: "30 days",
  RESET: "60 minutes",
  ADMIN_RESET: "24 hours",
};

export function hashPasswordSetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** 32 CSPRNG bytes, base64url so the whole thing survives a URL path segment. */
export function generatePasswordSetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPasswordSetToken(token) };
}

export function passwordSetUrl(token: string): string {
  return `${getAppUrl()}/set-password/${token}`;
}

/**
 * Mint a link for `userId`. Returns the raw token — the ONLY moment it
 * exists in memory. Callers put it straight into an email and drop it.
 */
export async function issuePasswordSetToken(
  userId: string,
  purpose: PasswordSetPurpose
): Promise<{ token: string; url: string; expiresAt: Date; ttlLabel: string }> {
  const { token, tokenHash } = generatePasswordSetToken();
  const expiresAt = new Date(Date.now() + PASSWORD_SET_TTL_MS[purpose]);

  await prisma.passwordSetToken.create({
    data: { userId, tokenHash, purpose, expiresAt },
  });

  return {
    token,
    url: passwordSetUrl(token),
    expiresAt,
    ttlLabel: PASSWORD_SET_TTL_LABEL[purpose],
  };
}

export interface PasswordSetTokenLookup {
  id: string;
  userId: string;
  purpose: string;
  userName: string;
  userEmail: string;
}

/**
 * Read-only validation for rendering the form. Returns null for unknown,
 * expired, used, and inactive-account tokens alike — the page shows one
 * neutral message for all of them, same as /sign/[token].
 */
export async function findValidPasswordSetToken(
  rawToken: string
): Promise<PasswordSetTokenLookup | null> {
  const row = await prisma.passwordSetToken.findUnique({
    where: { tokenHash: hashPasswordSetToken(rawToken) },
    select: {
      id: true,
      userId: true,
      purpose: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { name: true, email: true, isActive: true } },
    },
  });

  if (!row || row.usedAt || row.expiresAt <= new Date() || !row.user.isActive) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    purpose: row.purpose,
    userName: row.user.name,
    userEmail: row.user.email,
  };
}

/**
 * Atomic single-use claim, same shape as the SigningToken claim in
 * document-actions: the `usedAt: null` predicate lives inside the UPDATE, so
 * two concurrent redemptions of the same link can never both succeed.
 * Call inside the transaction that sets the password, so a failure there
 * releases the token instead of burning it.
 */
export async function claimPasswordSetToken(
  tx: Pick<typeof prisma, "passwordSetToken">,
  tokenHash: string
): Promise<boolean> {
  const claimed = await tx.passwordSetToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1;
}
