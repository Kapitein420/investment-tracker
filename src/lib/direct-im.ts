import { prisma } from "@/lib/db";
import { getUserCompanyIds } from "@/lib/user-companies";
import { TERMS_VERSION } from "@/lib/terms";

/**
 * DIRECT_IM assets have no NDA step: the portal terms click-accept
 * (TermsAcceptance) is the legal gate and the IM is open straight away.
 *
 * The existing gating everywhere (page filter, getAssetContentForInvestor,
 * the journey UI) keys off "NDA COMPLETED + approvedAt". Rather than fork all
 * of it, we promote the NDA and IM stages once the investor has accepted the
 * current terms, so the audit trail reads: terms accepted at T -> NDA stage
 * satisfied at T (approvedAt = T) -> IM open. The StageHistory note names the
 * mechanism so nobody mistakes it for a signed NDA.
 *
 * Idempotent and a no-op for STANDARD assets or before terms are accepted.
 * Called after acceptTerms, on the deal page, and before IM content is served.
 */
export async function promoteDirectImTrackings(userId: string): Promise<void> {
  const acceptance = await prisma.termsAcceptance.findUnique({
    where: { userId_termsVersion: { userId, termsVersion: TERMS_VERSION } },
    select: { acceptedAt: true },
  });
  if (!acceptance) return;

  const companyIds = await getUserCompanyIds(userId);
  if (companyIds.length === 0) return;

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: {
      companyId: { in: companyIds },
      asset: { accessMode: "DIRECT_IM" },
    },
    include: { stageStatuses: { include: { stage: true } } },
  });

  for (const tracking of trackings) {
    const nda = tracking.stageStatuses.find((s) => s.stage.key === "nda");
    const im = tracking.stageStatuses.find((s) => s.stage.key === "im");
    const ndaDone = nda?.status === "COMPLETED" && nda.approvedAt != null;
    const imDone = im?.status === "COMPLETED";
    if (ndaDone && imDone) continue;

    await prisma.$transaction(async (tx) => {
      for (const [ss, approve] of [
        [nda, true],
        [im, false],
      ] as const) {
        if (!ss || (ss.status === "COMPLETED" && (!approve || ss.approvedAt))) continue;
        await tx.stageStatus.update({
          where: { id: ss.id },
          data: {
            status: "COMPLETED",
            completedAt: ss.completedAt ?? acceptance.acceptedAt,
            updatedByUserId: userId,
            ...(approve
              ? { approvedAt: acceptance.acceptedAt }
              : {}),
          },
        });
        await tx.stageHistory.create({
          data: {
            trackingId: tracking.id,
            stageId: ss.stageId,
            fieldName: "status",
            oldValue: ss.status,
            newValue: "COMPLETED",
            changedByUserId: userId,
            note: "auto:direct-im-terms-accepted",
          },
        });
      }
    });
  }
}
