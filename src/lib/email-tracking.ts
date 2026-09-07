import { prisma } from "@/lib/db";

/** Bump when the portal preferences copy materially changes what the
 *  investor is agreeing to — lets us tell "consented under the old wording"
 *  apart from "consented under the current one" if that copy ever changes. */
export const TRACKING_NOTICE_VERSION = "2026-09-v1";

// Exported (not just used internally) so normalisation itself is unit-
// testable without a database — the three consent functions below all
// route through it and are otherwise DB-backed and untested here.
export function normalise(email: string): string {
  return email.trim().toLowerCase();
}

export async function hasTrackingConsent(email: string): Promise<boolean> {
  const row = await prisma.emailTrackingConsent.findUnique({
    where: { email: normalise(email) },
    select: { revokedAt: true },
  });
  return row !== null && row.revokedAt === null;
}

/**
 * Record (or re-activate) consent. Upsert so opting in again after a
 * revoke — or re-submitting the same choice — just refreshes the grant
 * instead of erroring on the unique email constraint.
 */
export async function grantTrackingConsent({
  email,
  userId,
  ip,
}: {
  email: string;
  userId?: string | null;
  ip?: string | null;
}): Promise<void> {
  const normalised = normalise(email);
  const now = new Date();
  const data = {
    userId: userId ?? null,
    grantedAt: now,
    revokedAt: null,
    noticeVersion: TRACKING_NOTICE_VERSION,
    source: "portal",
    ip: ip ?? null,
  };
  await prisma.emailTrackingConsent.upsert({
    where: { email: normalised },
    create: { email: normalised, ...data },
    update: data,
  });
}

/** No-op if the recipient never granted consent — updateMany matches zero
 *  rows instead of throwing, unlike update(). */
export async function revokeTrackingConsent(email: string): Promise<void> {
  await prisma.emailTrackingConsent.updateMany({
    where: { email: normalise(email) },
    data: { revokedAt: new Date() },
  });
}

/** Mailgun message-level tracking flags. These override the domain's
 *  dashboard default, which is how a single per-recipient consent check
 *  keeps tracking off regardless of what's configured in Mailgun. */
export function trackingOptions(
  consented: boolean
): { "o:tracking": "yes" | "no"; "o:tracking-opens": "yes" | "no"; "o:tracking-clicks": "yes" | "no" } {
  const value = consented ? "yes" : "no";
  return { "o:tracking": value, "o:tracking-opens": value, "o:tracking-clicks": value };
}
