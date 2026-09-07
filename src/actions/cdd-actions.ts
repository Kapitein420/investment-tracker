"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { setCompanyCddSchema, type SetCompanyCddInput } from "@/lib/validators";

/**
 * Buyer-side Wwft CDD / sanctions-screening attestation on a Company (G7).
 *
 * This is a soft, manual marker — NOT a KYC engine and NOT document
 * storage. The actual client due diligence file lives in Dils's Wwft
 * system outside this app; this just records that it happened before a
 * deal reaches the NBO stage, for the soft gate in
 * tracking-actions.ts#updateStageStatus.
 */
export async function setCompanyCdd(data: SetCompanyCddInput) {
  const user = await requireRole("EDITOR");
  const validated = setCompanyCddSchema.parse(data);

  const company = await prisma.$transaction(async (tx) => {
    const existing = await tx.company.findUniqueOrThrow({
      where: { id: validated.companyId },
    });

    const becomesCleared = validated.cddStatus === "CLEARED";

    const updated = await tx.company.update({
      where: { id: validated.companyId },
      data: {
        cddStatus: validated.cddStatus,
        cddNote: validated.cddNote || null,
        // Only stamp cleared-by when the status transitions TO CLEARED;
        // any other status clears both fields so a stale "cleared by X"
        // can't linger once someone downgrades the status.
        cddClearedAt: becomesCleared ? new Date() : null,
        cddClearedByUserId: becomesCleared ? user.id : null,
        // Set once, keep forever — re-screening isn't tracked here, and
        // unchecking the box in a later edit must not erase evidence that
        // screening already happened once.
        sanctionsScreenedAt:
          validated.sanctionsScreened && !existing.sanctionsScreenedAt
            ? new Date()
            : existing.sanctionsScreenedAt,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "Company",
        entityId: validated.companyId,
        action: "COMPANY_CDD_UPDATED",
        metadata: {
          oldStatus: existing.cddStatus,
          newStatus: validated.cddStatus,
          sanctionsScreened: validated.sanctionsScreened,
        },
        userId: user.id,
      },
    });

    return updated;
  });

  revalidatePath("/assets");
  return company;
}
