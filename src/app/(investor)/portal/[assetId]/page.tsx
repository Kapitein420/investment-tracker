import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { getSignedUrl } from "@/lib/supabase-storage";
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
      return c;
    })
  );

  return (
    <DealJourney
      tracking={tracking}
      contents={contents}
    />
  );
}
