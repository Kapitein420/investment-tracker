import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { getSignedUrl } from "@/lib/supabase-storage";
import { DealJourney } from "@/components/investor/deal-journey";
import { getUserCompanyIds } from "@/lib/user-companies";

export default async function InvestorDealPage({ params }: { params: { assetId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Sprint B PR-2: an investor can hold this asset under any of their
  // companies. Find the first matching tracking across ALL their
  // memberships rather than only the legacy User.companyId scalar.
  const companyIds = await getUserCompanyIds(user.id);
  if (companyIds.length === 0) redirect("/portal");

  const tracking = await prisma.assetCompanyTracking.findFirst({
    where: {
      assetId: params.assetId,
      companyId: { in: companyIds },
    },
    include: {
      asset: true,
      company: true,
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

  if (!tracking) notFound();
  if (tracking.lifecycleStatus === "DROPPED") notFound();

  // Fetch published content for this asset
  const rawContents = await prisma.assetContent.findMany({
    where: { assetId: params.assetId, isPublished: true },
  });

  // Generate signed URLs for PDF content so they're viewable in the browser
  const contents = await Promise.all(
    rawContents.map(async (c) => {
      if (c.contentType === "PDF" && c.fileUrl && !c.fileUrl.startsWith("http")) {
        try {
          const signedUrl = await getSignedUrl(c.fileUrl, 7200);
          return { ...c, fileUrl: signedUrl };
        } catch {
          return c;
        }
      }
      if (c.contentType === "LANDING_PAGE" && Array.isArray(c.imageUrls) && c.imageUrls.length > 0) {
        const signedImages = await Promise.all(
          (c.imageUrls as string[]).map(async (path) => {
            if (!path || typeof path !== "string") return null;
            if (path.startsWith("http")) return path;
            try {
              return await getSignedUrl(path, 7200);
            } catch {
              return null;
            }
          })
        );
        return { ...c, imageUrls: signedImages.filter(Boolean) };
      }
      return c;
    })
  );

  // Filter contents to only include stages the investor has access to
  const unlockedStageKeys = new Set<string>();
  const sortedStatuses = tracking.stageStatuses.sort((a: any, b: any) => a.stage.sequence - b.stage.sequence);

  for (let i = 0; i < sortedStatuses.length; i++) {
    const ss = sortedStatuses[i];
    const prevSs = i > 0 ? sortedStatuses[i - 1] : null;

    // Teaser always unlocked
    if (!prevSs || ss.status === "COMPLETED" || ss.status === "IN_PROGRESS") {
      unlockedStageKeys.add(ss.stage.key);
    }
    // Check if previous stage allows access
    if (prevSs && prevSs.status === "COMPLETED") {
      if (prevSs.stage.key !== "nda" || prevSs.approvedAt) {
        unlockedStageKeys.add(ss.stage.key);
      }
    }
  }

  const filteredContents = contents.filter((c: any) => unlockedStageKeys.has(c.stageKey));

  return (
    <DealJourney
      tracking={tracking}
      contents={filteredContents}
    />
  );
}
