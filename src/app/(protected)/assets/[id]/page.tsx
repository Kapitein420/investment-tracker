import { prisma } from "@/lib/db";
import { getCurrentUser, requireAssetAccess } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { AssetDetailView } from "@/components/asset/asset-detail-view";

// Bulk invite (up to 200 investors per batch) calls Mailgun once per row;
// 200 × ~300ms ≈ 60s. Vercel's default function timeout is 60s on Pro and
// 10s on Hobby — bump to 300s here so the action finishes comfortably.
// On Hobby this declaration is ignored and the function still hard-caps at
// 10s; switch to Pro before running large batches.
export const maxDuration = 300;

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // VIEWER role: hard-block direct URL access to assets they weren't
  // granted. We render notFound() rather than throwing so we don't leak
  // existence — a VIEWER who guesses an id sees the same 404 as a typo.
  if (user.role === "VIEWER") {
    try {
      await requireAssetAccess(user.id, user.role, params.id);
    } catch {
      notFound();
    }
  }

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

  // Owner picker: only internal team accounts (ADMIN/EDITOR/VIEWER) — never
  // INVESTORs. The picker is reused by the tracking drawer and the bulk
  // assign menu, so filtering at the data source covers both surfaces.
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { not: "INVESTOR" } },
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
