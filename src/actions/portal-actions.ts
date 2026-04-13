"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";

// Stage unlock rules:
// - teaser: always unlocked
// - nda: unlocked if teaser is COMPLETED
// - im: unlocked if nda has approvedAt set
// - viewing: unlocked if im is COMPLETED
// - nbo: unlocked if viewing is COMPLETED
const STAGE_UNLOCK_RULES: Record<
  string,
  (stages: Map<string, { status: string; approvedAt: Date | null }>) => boolean
> = {
  teaser: () => true,
  nda: (stages) => stages.get("teaser")?.status === "COMPLETED",
  im: (stages) => stages.get("nda")?.approvedAt != null,
  viewing: (stages) => stages.get("im")?.status === "COMPLETED",
  nbo: (stages) => stages.get("viewing")?.status === "COMPLETED",
};

function computeUnlockedStages(
  stageStatuses: Array<{
    stage: { key: string };
    status: string;
    approvedAt: Date | null;
  }>
): Record<string, boolean> {
  const stageMap = new Map(
    stageStatuses.map((ss) => [
      ss.stage.key,
      { status: ss.status, approvedAt: ss.approvedAt },
    ])
  );

  const unlocked: Record<string, boolean> = {};
  for (const [key, rule] of Object.entries(STAGE_UNLOCK_RULES)) {
    unlocked[key] = rule(stageMap);
  }

  return unlocked;
}

export async function getInvestorDeals() {
  const user = await requireUser();

  if (user.role !== "INVESTOR") {
    throw new Error("Forbidden: investor access only");
  }

  if (!user.companyId) {
    throw new Error("Investor has no associated company");
  }

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: { companyId: user.companyId },
    include: {
      asset: true,
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
      documents: {
        include: {
          stage: true,
          signingTokens: {
            where: { usedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return trackings.map((tracking) => ({
    ...tracking,
    unlockedStages: computeUnlockedStages(tracking.stageStatuses),
  }));
}

export async function getAssetContentForInvestor(
  assetId: string,
  stageKey: string
) {
  const user = await requireUser();

  if (user.role !== "INVESTOR") {
    throw new Error("Forbidden: investor access only");
  }

  if (!user.companyId) {
    throw new Error("Investor has no associated company");
  }

  // Verify the investor's company has a tracking for this asset
  const tracking = await prisma.assetCompanyTracking.findFirst({
    where: {
      assetId,
      companyId: user.companyId,
    },
    include: {
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
    },
  });

  if (!tracking) {
    throw new Error("No access to this asset");
  }

  // Verify the stage is unlocked
  const unlocked = computeUnlockedStages(tracking.stageStatuses);
  if (!unlocked[stageKey]) {
    throw new Error("This stage is not yet unlocked");
  }

  // For gated stages (im), additionally check approvedAt
  if (stageKey === "im") {
    const ndaStatus = tracking.stageStatuses.find(
      (ss) => ss.stage.key === "nda"
    );
    if (!ndaStatus?.approvedAt) {
      throw new Error("NDA approval required to access IM content");
    }
  }

  const content = await prisma.assetContent.findMany({
    where: {
      assetId,
      stageKey,
      isPublished: true,
    },
  });

  return content.length > 0 ? content : null;
}
