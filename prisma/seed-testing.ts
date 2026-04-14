import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Find admin user to assign as asset creator
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin user found. Run main seed first.");

  // Find pipeline stages
  const stages = await prisma.pipelineStage.findMany({ orderBy: { sequence: "asc" } });
  if (stages.length === 0) throw new Error("No pipeline stages. Run main seed first.");

  // Create test asset
  const asset = await prisma.asset.upsert({
    where: { id: "test_asset_001" },
    update: {},
    create: {
      id: "test_asset_001",
      title: "Keizersgracht 250",
      address: "Keizersgracht 250",
      city: "Amsterdam",
      country: "Netherlands",
      brokerLabel: "TEST — DILS",
      assetType: "Apartment Complex",
      transactionType: "Investment Sale",
      description: "TEST ASSET — used for internal testing only. 24 residential units in central Amsterdam.",
      createdById: admin.id,
    },
  });

  // Test companies
  const testCompanies = [
    { id: "test_co_1", name: "Amsterdam Capital Partners" },
    { id: "test_co_2", name: "Grachtenfonds" },
    { id: "test_co_3", name: "Dutch Real Estate Co" },
    { id: "test_co_4", name: "Heritage Investments BV" },
    { id: "test_co_5", name: "Randstad Properties" },
  ];

  for (const c of testCompanies) {
    await prisma.company.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        type: "INVESTOR",
        contactEmail: `contact@${c.id}.example.com`,
      },
    });
  }

  // Create test investor user linked to first company
  const passwordHash = await bcrypt.hash("testtest123", 12);
  await prisma.user.upsert({
    where: { email: "test.investor@example.com" },
    update: { passwordHash, companyId: "test_co_1" },
    create: {
      email: "test.investor@example.com",
      name: "Test Investor",
      passwordHash,
      role: "INVESTOR",
      companyId: "test_co_1",
      isActive: true,
    },
  });

  // Create tracking rows
  const trackings = [
    { id: "test_tr_1", companyId: "test_co_1", stageIndex: 1 }, // NDA
    { id: "test_tr_2", companyId: "test_co_2", stageIndex: 0 }, // Teaser
    { id: "test_tr_3", companyId: "test_co_3", stageIndex: 2 }, // IM
    { id: "test_tr_4", companyId: "test_co_4", stageIndex: 1 }, // NDA
    { id: "test_tr_5", companyId: "test_co_5", stageIndex: 0 }, // Teaser
  ];

  for (const t of trackings) {
    await prisma.assetCompanyTracking.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        assetId: asset.id,
        companyId: t.companyId,
        relationshipType: "Investor",
        lifecycleStatus: "ACTIVE",
        interestLevel: "WARM",
        currentStageKey: stages[t.stageIndex].key,
      },
    });

    // Stage statuses
    for (let i = 0; i < stages.length; i++) {
      const status = i < t.stageIndex ? "COMPLETED" : i === t.stageIndex ? "IN_PROGRESS" : "NOT_STARTED";
      await prisma.stageStatus.upsert({
        where: { trackingId_stageId: { trackingId: t.id, stageId: stages[i].id } },
        update: { status },
        create: {
          trackingId: t.id,
          stageId: stages[i].id,
          status,
          completedAt: status === "COMPLETED" ? new Date() : null,
          approvedAt: status === "COMPLETED" && stages[i].key === "nda" ? new Date() : null,
          approvedByUserId: status === "COMPLETED" && stages[i].key === "nda" ? admin.id : null,
        },
      });
    }

    // Comment
    await prisma.comment.create({
      data: {
        trackingId: t.id,
        authorUserId: admin.id,
        body: "TEST — Sample comment for testing purposes.",
      },
    });
  }

  console.log("✓ Testing asset seeded successfully");
  console.log(`  Asset: ${asset.title}`);
  console.log(`  Test investor login: test.investor@example.com / testtest123`);
  console.log(`  ${testCompanies.length} test companies, ${trackings.length} tracking rows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
