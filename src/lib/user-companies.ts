import { prisma } from "@/lib/db";

/**
 * Sprint B PR-1 — multi-company shim.
 *
 * Returns every Company a User belongs to. Reads from the new
 * UserCompanyMembership join table; falls back to the legacy User.companyId
 * scalar so the platform keeps working before the backfill runs (PR-3/PR-4)
 * and during the dual-read transition.
 *
 * Today most portal queries read User.companyId directly. That's fine —
 * this helper is here so the portal page (PR-2) can ask for "all my
 * companies" in one place, and the old single-companyId path stays
 * intact in the meantime.
 */
export async function getUserCompanyIds(userId: string): Promise<string[]> {
  const memberships = await prisma.userCompanyMembership.findMany({
    where: { userId },
    select: { companyId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length > 0) {
    return memberships.map((m) => m.companyId);
  }

  // Pre-backfill fallback: every existing INVESTOR has a User.companyId
  // scalar but no membership row yet. Treat that scalar as their sole
  // membership until the backfill script runs.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  return user?.companyId ? [user.companyId] : [];
}

/**
 * Convenience: the "primary" company for a user — first by createdAt,
 * falling back to User.companyId. This is what existing single-company
 * code paths should use until they're migrated to plural-aware queries.
 */
export async function getPrimaryCompanyId(userId: string): Promise<string | null> {
  const ids = await getUserCompanyIds(userId);
  return ids[0] ?? null;
}

/**
 * Idempotent: ensure a (user, company) membership row exists. Used by the
 * invite flow so re-inviting an existing user to a new company doesn't
 * duplicate the User row — the join captures the new relationship instead.
 */
export async function ensureUserCompanyMembership(
  userId: string,
  companyId: string
): Promise<void> {
  await prisma.userCompanyMembership.upsert({
    where: { userId_companyId: { userId, companyId } },
    update: {}, // No-op on existing row — keeps original createdAt for "primary" inference
    create: { userId, companyId },
  });
}
