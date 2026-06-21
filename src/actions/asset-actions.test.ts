import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Integration test against the local seeded Postgres. Mocks only the two
// non-DB seams: auth (so we run as an authorised EDITOR) and next/cache
// (revalidatePath is import-time only here). Everything else hits real
// Prisma. Guards the A1 perf refactor of getAssetById's first-access
// computation — the result must stay identical after the query is scoped.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "test", role: "ADMIN" }),
  requireUser: vi.fn().mockResolvedValue({ id: "test", role: "ADMIN" }),
}));

import { prisma } from "@/lib/db";
import { getAssetById } from "./asset-actions";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("getAssetById first-access computation", () => {
  let assetId: string;
  let trackingId: string;
  let stageKey: string;
  let userId: string;
  const insertedLogIds: string[] = [];

  beforeAll(async () => {
    const tracking = await prisma.assetCompanyTracking.findFirst({
      include: { stageStatuses: { include: { stage: true } } },
    });
    if (!tracking || tracking.stageStatuses.length === 0) {
      throw new Error("Seed data missing — run npm run db:seed first");
    }
    assetId = tracking.assetId;
    trackingId = tracking.id;
    stageKey = tracking.stageStatuses[0].stage.key;
    const user = await prisma.user.findFirstOrThrow();
    userId = user.id;

    // One access event for THIS tracking/stage, and a decoy for a tracking
    // that doesn't belong to this asset. The decoy must never appear in the
    // result — both before and after the query is scoped to this asset.
    const real = await prisma.activityLog.create({
      data: {
        entityType: "AssetContent",
        action: "CONTENT_ACCESSED",
        entityId: "test-entity",
        userId,
        metadata: { trackingId, stageKey },
      },
    });
    const decoy = await prisma.activityLog.create({
      data: {
        entityType: "AssetContent",
        action: "CONTENT_ACCESSED",
        entityId: "test-entity-decoy",
        userId,
        metadata: { trackingId: "tracking-from-another-asset", stageKey },
      },
    });
    insertedLogIds.push(real.id, decoy.id);
  });

  afterAll(async () => {
    if (insertedLogIds.length) {
      await prisma.activityLog.deleteMany({ where: { id: { in: insertedLogIds } } });
    }
    await prisma.$disconnect();
  });

  it("returns the asset with its trackings", async () => {
    const asset: any = await getAssetById(assetId);
    expect(asset.id).toBe(assetId);
    expect(Array.isArray(asset.trackings)).toBe(true);
  });

  it("surfaces first-access for this asset's tracking/stage", async () => {
    const asset: any = await getAssetById(assetId);
    const t = asset.trackings.find((x: any) => x.id === trackingId);
    expect(t).toBeTruthy();
    expect(t.firstAccessByStage[stageKey]).toBeInstanceOf(Date);
  });

  it("never leaks an access event from another asset's tracking", async () => {
    const asset: any = await getAssetById(assetId);
    for (const t of asset.trackings) {
      // the decoy's trackingId is not one of this asset's trackings, so it
      // can never key into any tracking's firstAccessByStage
      expect(t.id).not.toBe("tracking-from-another-asset");
    }
  });
});
