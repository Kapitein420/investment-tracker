// Small helper for the verify-as-viewer skill: look up VIEWER users and
// trackings worth testing against, and grant/revoke AssetViewerAccess rows
// for the local dev DB. Not a general admin tool — local verification only.
//
// Usage (from the worktree root; tsx does not auto-load .env):
//   DATABASE_URL="$(grep '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')" \
//     npx tsx .claude/skills/verify-as-viewer/scripts/viewer-access.ts lookup
//   ... grant <assetId> [email]
//   ... revoke <assetId> [email]

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USAGE =
  "Usage: viewer-access.ts lookup | grant <assetId> [email] | revoke <assetId> [email]";

async function lookup() {
  const viewers = await prisma.user.findMany({
    where: { role: "VIEWER" },
    select: { id: true, email: true },
  });

  const access = await prisma.assetViewerAccess.findMany({
    where: { userId: { in: viewers.map((v) => v.id) } },
    select: { id: true, userId: true, assetId: true, grantedAt: true },
  });

  const trackingRows = await prisma.assetCompanyTracking.findMany({
    take: 10,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      assetId: true,
      asset: { select: { title: true } },
      company: { select: { name: true } },
      _count: { select: { stageHistory: true, comments: true } },
    },
  });

  const trackings = await Promise.all(
    trackingRows.map(async (t) => ({
      id: t.id,
      assetId: t.assetId,
      assetTitle: t.asset.title,
      companyName: t.company.name,
      stageHistoryCount: t._count.stageHistory,
      commentCount: t._count.comments,
      documentCount: await prisma.document.count({ where: { trackingId: t.id } }),
    }))
  );

  console.log(JSON.stringify({ viewers, access, trackings }, null, 2));
}

async function grant(assetId: string, email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  const row = await prisma.assetViewerAccess.upsert({
    where: { userId_assetId: { userId: user.id, assetId } },
    update: {},
    create: { userId: user.id, assetId },
  });
  console.log(row.id);
}

async function revoke(assetId: string, email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  const result = await prisma.assetViewerAccess.deleteMany({
    where: { userId: user.id, assetId },
  });
  console.log(result.count);
}

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2);

  if (cmd === "lookup") {
    await lookup();
    return;
  }

  if (cmd === "grant" || cmd === "revoke") {
    if (!arg1) {
      console.error(USAGE);
      process.exit(1);
    }
    const email = arg2 ?? "viewer@example.com";
    if (cmd === "grant") await grant(arg1, email);
    else await revoke(arg1, email);
    return;
  }

  console.error(USAGE);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
