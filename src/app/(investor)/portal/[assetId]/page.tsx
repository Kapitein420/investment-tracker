import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { DealJourney } from "@/components/investor/deal-journey";

export default async function InvestorDealPage({ params }: { params: { assetId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.companyId) redirect("/portal");

  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: {
      assetId_companyId: {
        assetId: params.assetId,
        companyId: user.companyId,
      },
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

  // Fetch published content for this asset
  const contents = await prisma.assetContent.findMany({
    where: { assetId: params.assetId, isPublished: true },
  });

  return (
    <DealJourney
      tracking={tracking}
      contents={contents}
    />
  );
}
