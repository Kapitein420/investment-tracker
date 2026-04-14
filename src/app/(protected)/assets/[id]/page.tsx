import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { AssetDetailView } from "@/components/asset/asset-detail-view";

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      trackings: {
        include: {
          company: true,
          ownerUser: { select: { id: true, name: true } },
          stageStatuses: {
            include: { stage: true },
            orderBy: { stage: { sequence: "asc" } },
          },
          comments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { author: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) notFound();

  const stages = await prisma.pipelineStage.findMany({
    where: { isActive: true },
    orderBy: { sequence: "asc" },
  });

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    take: 500,
  });

  const contents = await prisma.assetContent.findMany({
    where: { assetId: params.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AssetDetailView
      asset={asset}
      stages={stages}
      users={users}
      companies={companies}
      contents={contents}
      currentUser={user}
    />
  );
}
