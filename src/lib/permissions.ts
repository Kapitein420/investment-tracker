import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireRole(minimumRole: Role) {
  const user = await requireUser();
  const hierarchy: Record<Role, number> = {
    INVESTOR: 0,
    VIEWER: 1,
    EDITOR: 2,
    ADMIN: 3,
  };
  if (hierarchy[user.role] < hierarchy[minimumRole]) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function requireInvestor() {
  const user = await requireUser();
  if (user.role !== "INVESTOR") throw new Error("Forbidden: investor access only");
  return user;
}

export function canEdit(role: Role) {
  return role === "ADMIN" || role === "EDITOR";
}

export function isAdmin(role: Role) {
  return role === "ADMIN";
}

export function isInvestor(role: Role) {
  return role === "INVESTOR";
}

export function isViewer(role: Role) {
  return role === "VIEWER";
}

/**
 * Whether this role can see PII (contact names, emails, individual user
 * names). VIEWER is intentionally restricted — opdrachtgevers (clients)
 * can see deal flow & status but never investor identities or DILS-side
 * staff identities.
 */
export function canSeeContactDetails(role: Role) {
  return role === "ADMIN" || role === "EDITOR" || role === "INVESTOR";
}

/**
 * Per-asset access enforcement for the VIEWER role.
 *
 * Returns:
 *  - `null` for ADMIN / EDITOR — they see everything (use this as a
 *    "skip filter" sentinel rather than fetching ids unnecessarily).
 *  - `string[]` for VIEWER — exact list of asset ids the viewer is
 *    allowed to see. Empty array means no access at all.
 *  - `string[]` (empty) for INVESTOR — investors don't use this gate
 *    (they go through AssetCompanyTracking on /portal). Defensive zero.
 *
 * The DB row is the source of truth; never trust client-supplied IDs.
 */
export async function getViewerAccessibleAssetIds(
  userId: string,
  role: Role
): Promise<string[] | null> {
  if (role === "ADMIN" || role === "EDITOR") return null;
  if (role !== "VIEWER") return [];

  // Defensive: if the AssetViewerAccess table doesn't exist yet (prod DB
  // out of sync with the schema after a `db push` was missed), fail
  // closed instead of 500-ing the entire homepage. Empty list ⇒ the
  // dashboard renders the empty-state branch, which the operator can
  // diagnose and unblock with one `prisma db push`.
  try {
    const rows = await prisma.assetViewerAccess.findMany({
      where: { userId },
      select: { assetId: true },
    });
    return rows.map((r) => r.assetId);
  } catch (e: any) {
    if (e?.code === "P2021") {
      console.error(
        "[getViewerAccessibleAssetIds] AssetViewerAccess table missing on this DB — " +
          "run `prisma db push` to sync. Returning empty access list as fallback.",
        e
      );
      return [];
    }
    throw e;
  }
}

/**
 * Hard guard for asset-scoped pages — throws "Forbidden" so route handlers
 * can let it propagate to the error boundary (Next renders 500 with a
 * neutral message, never leaking that the asset exists). VIEWERs without
 * an access row see "Forbidden"; ADMIN / EDITOR pass through.
 */
export async function requireAssetAccess(
  userId: string,
  role: Role,
  assetId: string
): Promise<void> {
  if (role === "ADMIN" || role === "EDITOR") return;
  if (role !== "VIEWER") throw new Error("Forbidden");

  const access = await prisma.assetViewerAccess.findUnique({
    where: { userId_assetId: { userId, assetId } },
    select: { id: true },
  });
  if (!access) throw new Error("Forbidden");
}
