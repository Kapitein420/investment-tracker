import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getSignedUrl } from "@/lib/supabase-storage";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const assets = await prisma.asset.findMany({
    include: {
      _count: { select: { trackings: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // Pull the first teaser image per asset to render as a row thumbnail.
  // We do this in two steps so the dashboard query stays cheap on its
  // hot path: one bulk query for AssetContent, then per-asset cherry-pick.
  const assetIds = assets.map((a) => a.id);
  const teaserContents =
    assetIds.length === 0
      ? []
      : await prisma.assetContent.findMany({
          where: {
            assetId: { in: assetIds },
            stageKey: "teaser",
            contentType: "LANDING_PAGE",
            isPublished: true,
          },
          select: { assetId: true, imageUrls: true },
        });

  // Map assetId → first image storage path (or http URL)
  const firstImageByAsset = new Map<string, string>();
  for (const tc of teaserContents) {
    const arr = Array.isArray(tc.imageUrls) ? (tc.imageUrls as unknown as string[]) : [];
    const first = arr.find((u): u is string => typeof u === "string" && u.length > 0);
    if (first && !firstImageByAsset.has(tc.assetId)) {
      firstImageByAsset.set(tc.assetId, first);
    }
  }

  // Resolve signed URLs in parallel. http(s) URLs pass through; storage
  // paths get a 2-hour signed URL via the existing in-memory cache so a
  // refresh doesn't re-sign the same paths. Failures degrade silently to
  // the no-image fallback.
  const coverUrlByAsset = new Map<string, string>();
  await Promise.all(
    Array.from(firstImageByAsset.entries()).map(async ([assetId, raw]) => {
      try {
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
          coverUrlByAsset.set(assetId, raw);
        } else {
          const signed = await getSignedUrl(raw, 7200);
          coverUrlByAsset.set(assetId, signed);
        }
      } catch {
        // No cover image — DashboardContent falls back to a sector icon.
      }
    })
  );

  const assetsWithCover = assets.map((a) => ({
    ...a,
    coverImageUrl: coverUrlByAsset.get(a.id) ?? null,
  }));

  return <DashboardContent assets={assetsWithCover} userRole={user.role} />;
}
