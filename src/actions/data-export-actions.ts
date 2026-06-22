"use server";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

/**
 * Data-subject access & portability (GDPR Art. 15 & 20).
 *
 * Returns a machine-readable (JSON-serialisable) bundle of all personal data
 * the portal holds about one user, so a data-subject request can be fulfilled.
 * Admin-only — the DSAR procedure (compliance/data-subject-request-procedure.md)
 * covers identity verification before this is run.
 *
 * Deliberately EXCLUDES the password hash, and excludes the raw signature
 * image / signed-PDF bytes (available on request) to keep the export sane —
 * signed-document metadata is included so the subject knows what exists.
 */
export async function exportUserData(userId: string) {
  await requireRole("ADMIN");

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      companyId: true,
      passwordChangedAt: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: { companyId: true, createdAt: true, company: { select: { name: true } } },
      },
      comments: {
        select: { id: true, body: true, trackingId: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
      },
      savedViews: { select: { id: true, name: true, assetId: true, createdAt: true } },
      viewerAccess: { select: { assetId: true, grantedAt: true } },
      activityLogs: {
        select: { action: true, entityType: true, entityId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      },
    },
  });

  if (!account) throw new Error("User not found");

  // Documents this person signed are linked by email (signedByEmail), not FK.
  const signedDocuments = await prisma.document.findMany({
    where: { signedByEmail: { equals: account.email, mode: "insensitive" } },
    select: {
      id: true,
      fileName: true,
      status: true,
      kind: true,
      signedByName: true,
      signedByEmail: true,
      signedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Invitations addressed to this email.
  const invites = await prisma.investorInvite.findMany({
    where: { email: { equals: account.email, mode: "insensitive" } },
    select: {
      id: true,
      companyId: true,
      assetId: true,
      acceptedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    exportedAt: new Date().toISOString(),
    controller: "Dils Netherlands B.V.",
    notice:
      "Personal data held about this user in the DILS Investor Portal. Signature images and signed-PDF files are available on request and are excluded here for size.",
    account,
    signedDocuments,
    invites,
  };
}
