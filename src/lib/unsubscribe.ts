import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import type { EmailSuppressionReason } from "@prisma/client";

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

// NEXTAUTH_SECRET already gates session/JWT signing app-wide, so reusing it
// here means no new secret to provision or rotate. Throwing on startup
// (rather than falling back to a default) matches how auth.ts treats a
// missing secret — a silently-guessable token would defeat the point.
function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is required to sign unsubscribe tokens.");
  return s;
}

/** Hex HMAC-SHA256 of the normalised email, keyed with NEXTAUTH_SECRET. */
export function unsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", secret()).update(normalise(email)).digest("hex");
}

/** Constant-time check so the token can't be brute-forced via response timing. */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email), "hex");
  const provided = Buffer.from(typeof token === "string" ? token : "", "hex");
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

/** One-click unsubscribe link — embedded in every email footer and the List-Unsubscribe header. */
export function unsubscribeUrl(email: string): string {
  const normalised = normalise(email);
  const token = unsubscribeToken(normalised);
  return `${getAppUrl()}/unsubscribe?e=${encodeURIComponent(normalised)}&t=${token}`;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.emailSuppression.findUnique({
    where: { email: normalise(email) },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Record an opt-out or complaint. Upsert so a repeat unsubscribe click or a
 * later complaint on an already-suppressed address just refreshes the
 * reason/source instead of erroring on the unique email constraint.
 */
export async function suppressEmail(
  email: string,
  reason: EmailSuppressionReason,
  source: string
): Promise<void> {
  const normalised = normalise(email);
  await prisma.emailSuppression.upsert({
    where: { email: normalised },
    create: { email: normalised, reason, source },
    update: { reason, source },
  });
}
