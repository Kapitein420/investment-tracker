import { prisma } from "@/lib/db";

// Portal terms-of-use click-accept (compliance gap G13, BW 6:234). No new
// legal text — the existing "Algemene voorwaarden" link already in the
// investor footer is the terms text; bump this when that document changes
// materially, which asks every investor to accept again without touching
// the acceptance evidence already on file for the old version.
export const TERMS_VERSION = "2026-09";
export const TERMS_URL = "https://dils.nl/algemene-voorwaarden/";

export async function hasAcceptedCurrentTerms(userId: string): Promise<boolean> {
  const row = await prisma.termsAcceptance.findUnique({
    where: { userId_termsVersion: { userId, termsVersion: TERMS_VERSION } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Record acceptance of the current terms version. Upsert on the unique
 * (userId, termsVersion) pair — re-accepting (e.g. a double-submit) just
 * refreshes the evidence instead of erroring.
 */
export async function recordTermsAcceptance({
  userId,
  ip,
  userAgent,
}: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const data = {
    acceptedAt: new Date(),
    ip: ip ?? null,
    userAgent: userAgent ?? null,
  };
  await prisma.termsAcceptance.upsert({
    where: { userId_termsVersion: { userId, termsVersion: TERMS_VERSION } },
    create: { userId, termsVersion: TERMS_VERSION, ...data },
    update: data,
  });
}
