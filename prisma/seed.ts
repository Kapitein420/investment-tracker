import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Clean existing data (order matters for FK constraints) ──────────────
  await prisma.activityLog.deleteMany();
  await prisma.stageHistory.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.stageStatus.deleteMany();
  await prisma.assetCompanyTracking.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.company.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.user.deleteMany();

  // ─── 1. Users ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Noah Admin",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const editor = await prisma.user.create({
    data: {
      name: "Ezra Editor",
      email: "editor@example.com",
      passwordHash,
      role: "EDITOR",
    },
  });

  const viewer = await prisma.user.create({
    data: {
      name: "Sarah Viewer",
      email: "viewer@example.com",
      passwordHash,
      role: "VIEWER",
    },
  });

  console.log(`Created users: ${admin.name}, ${editor.name}, ${viewer.name}`);

  // ─── 2. Pipeline Stages ──────────────────────────────────────────────────
  const stageData = [
    { key: "teaser", label: "Teaser", sequence: 0 },
    { key: "nda", label: "NDA", sequence: 1 },
    { key: "im", label: "IM", sequence: 2 },
    { key: "viewing", label: "Viewing", sequence: 3 },
    { key: "nbo", label: "NBO", sequence: 4 },
  ] as const;

  const stages: Record<string, string> = {};
  for (const s of stageData) {
    const stage = await prisma.pipelineStage.create({ data: s });
    stages[s.key] = stage.id;
  }

  console.log(`Created ${stageData.length} pipeline stages`);

  // ─── 3. Asset ────────────────────────────────────────────────────────────
  const asset = await prisma.asset.create({
    data: {
      title: "Generaal Vetterstraat 82",
      address: "Generaal Vetterstraat 82",
      city: "Amsterdam",
      country: "Netherlands",
      brokerLabel: "CBRE",
      assetType: "Office",
      transactionType: "Investment Sale",
      ownerEntity: "Private Equity Fund",
      createdById: admin.id,
    },
  });

  console.log(`Created asset: ${asset.title}`);

  // ─── 4. Companies ────────────────────────────────────────────────────────
  const companyNames = [
    "Uptown",
    "Stoneweg",
    "GreenRoad Capital",
    "Dudok Real Estate",
    "Cocon",
    "Uijthoven",
    "Atland Voisin",
    "Jamestown",
    "Sofidy",
    "PingProperties",
    "NSI",
    "FLOW Real Estate",
    "APF",
    "Newomij",
    "Remake",
    "Corum",
    "Edge",
    "Edmond de Rothschild",
  ];

  const companies = await Promise.all(
    companyNames.map((name) =>
      prisma.company.create({
        data: { name, type: "INVESTOR" },
      })
    )
  );

  console.log(`Created ${companies.length} companies`);

  // ─── 5. Tracking rows + Stage statuses + Comments ────────────────────────

  // Realistic pipeline profiles for each company
  type StageProfile = {
    stages: Record<string, "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "DECLINED">;
    lifecycle: "ACTIVE" | "COMPLETED" | "DROPPED" | "ON_HOLD";
    interest: "HOT" | "WARM" | "COLD" | "NONE";
    relationship: string;
    owner: string | null;
    comments: string[];
  };

  const profiles: StageProfile[] = [
    // 0 - Uptown: advanced, hot
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "COMPLETED", viewing: "IN_PROGRESS", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "HOT", relationship: "Investor", owner: admin.id,
      comments: ["Very interested, scheduling viewing", "Strong interest, reviewing terms"],
    },
    // 1 - Stoneweg: dropped at NDA
    {
      stages: { teaser: "COMPLETED", nda: "DECLINED", im: "NOT_STARTED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "DROPPED", interest: "NONE", relationship: "Investor", owner: admin.id,
      comments: ["Not interested", "Value-add element is too small"],
    },
    // 2 - GreenRoad Capital: at IM stage
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "IN_PROGRESS", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "WARM", relationship: "Investor", owner: editor.id,
      comments: ["Several questions have been answered, waiting for response"],
    },
    // 3 - Dudok Real Estate: completed deal
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "COMPLETED", viewing: "COMPLETED", nbo: "COMPLETED" },
      lifecycle: "COMPLETED", interest: "HOT", relationship: "Investor", owner: admin.id,
      comments: ["NBO submitted and accepted", "Strong interest, reviewing terms"],
    },
    // 4 - Cocon: early stage
    {
      stages: { teaser: "IN_PROGRESS", nda: "NOT_STARTED", im: "NOT_STARTED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "WARM", relationship: "Investor", owner: editor.id,
      comments: ["Sent to contact", "Waiting for response"],
    },
    // 5 - Uijthoven: dropped early
    {
      stages: { teaser: "COMPLETED", nda: "DECLINED", im: "NOT_STARTED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "DROPPED", interest: "COLD", relationship: "Investor", owner: null,
      comments: ["Too involved in own projects"],
    },
    // 6 - Atland Voisin: at NDA
    {
      stages: { teaser: "COMPLETED", nda: "IN_PROGRESS", im: "NOT_STARTED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "WARM", relationship: "Investor", owner: admin.id,
      comments: ["Shared NDA and teaser", "Internal discussion this week"],
    },
    // 7 - Jamestown: on hold at IM
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "BLOCKED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ON_HOLD", interest: "COLD", relationship: "Investor", owner: editor.id,
      comments: ["Internal discussion this week", "Waiting for response"],
    },
    // 8 - Sofidy: advanced, scheduling viewing
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "COMPLETED", viewing: "IN_PROGRESS", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "HOT", relationship: "Investor", owner: admin.id,
      comments: ["Very interested, scheduling viewing"],
    },
    // 9 - PingProperties: declined at IM
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "DECLINED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "DROPPED", interest: "NONE", relationship: "Investor", owner: null,
      comments: ["Value-add element is too small", "Not interested"],
    },
    // 10 - NSI: warm, at NDA
    {
      stages: { teaser: "COMPLETED", nda: "IN_PROGRESS", im: "NOT_STARTED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "WARM", relationship: "Investor", owner: editor.id,
      comments: ["Shared NDA and teaser"],
    },
    // 11 - FLOW Real Estate: advisor, active
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "IN_PROGRESS", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "WARM", relationship: "Advisor", owner: admin.id,
      comments: ["Several questions have been answered, waiting for response", "Internal discussion this week"],
    },
    // 12 - APF: early teaser
    {
      stages: { teaser: "IN_PROGRESS", nda: "NOT_STARTED", im: "NOT_STARTED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "COLD", relationship: "Investor", owner: null,
      comments: ["Sent to contact"],
    },
    // 13 - Newomij: completed through NBO
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "COMPLETED", viewing: "COMPLETED", nbo: "IN_PROGRESS" },
      lifecycle: "ACTIVE", interest: "HOT", relationship: "Investor", owner: admin.id,
      comments: ["Strong interest, reviewing terms", "Very interested, scheduling viewing"],
    },
    // 14 - Remake: on hold
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "NOT_STARTED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ON_HOLD", interest: "COLD", relationship: "Investor", owner: editor.id,
      comments: ["Too involved in own projects", "Waiting for response"],
    },
    // 15 - Corum: advisor, active
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "COMPLETED", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "WARM", relationship: "Advisor", owner: admin.id,
      comments: ["Internal discussion this week"],
    },
    // 16 - Edge: dropped at viewing
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "COMPLETED", viewing: "DECLINED", nbo: "NOT_STARTED" },
      lifecycle: "DROPPED", interest: "NONE", relationship: "Investor", owner: null,
      comments: ["Not interested", "Value-add element is too small"],
    },
    // 17 - Edmond de Rothschild: warm, progressing
    {
      stages: { teaser: "COMPLETED", nda: "COMPLETED", im: "IN_PROGRESS", viewing: "NOT_STARTED", nbo: "NOT_STARTED" },
      lifecycle: "ACTIVE", interest: "WARM", relationship: "Investor", owner: editor.id,
      comments: ["Several questions have been answered, waiting for response", "Sent to contact"],
    },
  ];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const profile = profiles[i];

    // Determine currentStageKey based on the furthest active stage
    let currentStageKey: string | null = null;
    const stageKeys = ["teaser", "nda", "im", "viewing", "nbo"];
    for (const key of stageKeys) {
      if (profile.stages[key] === "IN_PROGRESS" || profile.stages[key] === "BLOCKED") {
        currentStageKey = key;
      }
    }
    // If all stages are completed, set to the last completed stage
    if (!currentStageKey) {
      for (const key of [...stageKeys].reverse()) {
        if (profile.stages[key] === "COMPLETED") {
          currentStageKey = key;
          break;
        }
      }
    }

    const latestComment = profile.comments[profile.comments.length - 1];

    const tracking = await prisma.assetCompanyTracking.create({
      data: {
        assetId: asset.id,
        companyId: company.id,
        relationshipType: profile.relationship,
        currentStageKey,
        lifecycleStatus: profile.lifecycle,
        interestLevel: profile.interest,
        ownerUserId: profile.owner,
        latestCommentPreview: latestComment,
        sortOrder: i,
      },
    });

    // Create StageStatus for all 5 stages
    for (const key of stageKeys) {
      const status = profile.stages[key];
      await prisma.stageStatus.create({
        data: {
          trackingId: tracking.id,
          stageId: stages[key],
          status,
          completedAt: status === "COMPLETED" ? new Date() : null,
          updatedByUserId: profile.owner ?? admin.id,
        },
      });
    }

    // Create comments
    const commentAuthors = [admin.id, editor.id];
    for (let c = 0; c < profile.comments.length; c++) {
      await prisma.comment.create({
        data: {
          trackingId: tracking.id,
          authorUserId: commentAuthors[c % commentAuthors.length],
          body: profile.comments[c],
        },
      });
    }
  }

  console.log("Created tracking rows, stage statuses, and comments for all 18 companies");
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
