-- ============================================================
-- INVESTMENT TRACKER — TEST DATA SCRIPTS
-- ============================================================
-- Run these in Supabase SQL Editor to set up and reset test data.
-- Each section is self-contained — run the whole file or pick sections.
-- ============================================================

-- ===============================================================
-- SECTION 1: CLEANUP (run before a fresh test)
-- ===============================================================
-- Removes all test data but keeps: admin users, pipeline stages, DILS assets

BEGIN;

-- Remove test documents first (cascades handle the rest)
DELETE FROM "Document" WHERE "fileName" LIKE '%TEST%' OR "fileName" LIKE 'NDA Test%';
DELETE FROM "AssetContent" WHERE "assetId" = 'test_asset_001';

-- Remove test trackings + stage statuses (cascades via FK)
DELETE FROM "AssetCompanyTracking"
  WHERE "assetId" = 'test_asset_001'
     OR "companyId" LIKE 'test_co_%';

-- Remove test invites
DELETE FROM "InvestorInvite"
  WHERE "assetId" = 'test_asset_001'
     OR "email" LIKE '%@test.dils.com';

-- Remove test investor users
DELETE FROM "User"
  WHERE "email" LIKE '%@test.dils.com'
     OR "email" = 'test.investor@example.com';

-- Remove test companies
DELETE FROM "Company" WHERE "id" LIKE 'test_co_%';

-- Remove test asset
DELETE FROM "Asset" WHERE "id" = 'test_asset_001';

-- Remove broken/orphaned data (NULL fileUrl IM entries, duplicate documents)
DELETE FROM "AssetContent" WHERE "stageKey" = 'im' AND "fileUrl" IS NULL;

COMMIT;

-- ===============================================================
-- SECTION 2: SEED TEST ASSET + COMPANIES
-- ===============================================================
-- Creates a clean test scenario: 1 asset, 5 companies at different stages

BEGIN;

-- Ensure we have an admin user to attribute the asset to
-- (uses existing admin@example.com from main seed)

-- Test asset: Keizersgracht 250
INSERT INTO "Asset" (
  "id", "title", "address", "city", "country",
  "brokerLabel", "assetType", "transactionType", "ownerEntity",
  "description", "createdById", "createdAt", "updatedAt"
) VALUES (
  'test_asset_001',
  'Keizersgracht 250 [TEST]',
  'Keizersgracht 250',
  'Amsterdam',
  'Netherlands',
  'DILS',
  'Office',
  'Investment Sale',
  'DILS Capital Partners',
  'Premium canal-side office building in Amsterdam Centrum. 3,200 sqm across 5 floors. Fully leased to tier-1 tenants. Test asset for internal QA.',
  (SELECT "id" FROM "User" WHERE "email" = 'admin@example.com' LIMIT 1),
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "updatedAt" = NOW();

-- 5 test companies covering different scenarios
INSERT INTO "Company" ("id", "name", "type", "contactName", "contactEmail", "createdAt", "updatedAt") VALUES
  ('test_co_1', 'Alpha Capital [TEST]',    'INVESTOR', 'Anna van Dijk',    'anna@test.dils.com',    NOW(), NOW()),
  ('test_co_2', 'Bravo Investments [TEST]', 'INVESTOR', 'Bas de Groot',     'bas@test.dils.com',     NOW(), NOW()),
  ('test_co_3', 'Charlie Holdings [TEST]',  'INVESTOR', 'Carla Janssen',    'carla@test.dils.com',   NOW(), NOW()),
  ('test_co_4', 'Delta Real Estate [TEST]', 'INVESTOR', 'Daan Meijer',      'daan@test.dils.com',    NOW(), NOW()),
  ('test_co_5', 'Echo Fund [TEST]',         'INVESTOR', 'Eva Bakker',       'eva@test.dils.com',     NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "contactEmail" = EXCLUDED."contactEmail",
  "updatedAt" = NOW();

COMMIT;

-- ===============================================================
-- SECTION 3: CREATE TRACKING ROWS AT DIFFERENT STAGES
-- ===============================================================
-- 5 companies, each at a different pipeline stage to test all UI states

BEGIN;

-- Helper: get stage IDs
-- (we reference them by key: teaser, nda, im, viewing, nbo)

-- Company 1: Fresh — nothing started yet (teaser stage NOT_STARTED)
INSERT INTO "AssetCompanyTracking" (
  "id", "assetId", "companyId", "relationshipType",
  "lifecycleStatus", "interestLevel", "createdAt", "updatedAt"
) VALUES (
  'test_tr_1', 'test_asset_001', 'test_co_1', 'Investor',
  'ACTIVE', 'WARM', NOW(), NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- Company 2: Teaser completed, ready to sign NDA
INSERT INTO "AssetCompanyTracking" (
  "id", "assetId", "companyId", "relationshipType",
  "currentStageKey", "lifecycleStatus", "interestLevel",
  "latestCommentPreview", "createdAt", "updatedAt"
) VALUES (
  'test_tr_2', 'test_asset_001', 'test_co_2', 'Investor',
  'nda', 'ACTIVE', 'HOT',
  'Teaser reviewed, ready for NDA', NOW(), NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- Company 3: NDA signed but NOT approved yet (under review)
INSERT INTO "AssetCompanyTracking" (
  "id", "assetId", "companyId", "relationshipType",
  "currentStageKey", "lifecycleStatus", "interestLevel",
  "latestCommentPreview", "createdAt", "updatedAt"
) VALUES (
  'test_tr_3', 'test_asset_001', 'test_co_3', 'Investor',
  'nda', 'ACTIVE', 'HOT',
  'NDA signed, awaiting admin approval', NOW(), NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- Company 4: NDA approved, IM stage unlocked
INSERT INTO "AssetCompanyTracking" (
  "id", "assetId", "companyId", "relationshipType",
  "currentStageKey", "lifecycleStatus", "interestLevel",
  "latestCommentPreview", "createdAt", "updatedAt"
) VALUES (
  'test_tr_4', 'test_asset_001', 'test_co_4', 'Investor',
  'im', 'ACTIVE', 'HOT',
  'Reviewing IM materials', NOW(), NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- Company 5: Dropped (filtered from investor view)
INSERT INTO "AssetCompanyTracking" (
  "id", "assetId", "companyId", "relationshipType",
  "currentStageKey", "lifecycleStatus", "interestLevel",
  "latestCommentPreview", "createdAt", "updatedAt"
) VALUES (
  'test_tr_5', 'test_asset_001', 'test_co_5', 'Investor',
  'nda', 'DROPPED', 'NONE',
  'Not a fit — dropped from pipeline', NOW(), NOW()
)
ON CONFLICT ("id") DO NOTHING;

COMMIT;

-- ===============================================================
-- SECTION 4: CREATE STAGE STATUSES FOR EACH TRACKING
-- ===============================================================

BEGIN;

-- Stage statuses for Company 1 (fresh — all NOT_STARTED except teaser IN_PROGRESS)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "createdAt", "updatedAt")
SELECT 'test_tr_1', s."id",
  CASE WHEN s."key" = 'teaser' THEN 'IN_PROGRESS'::"StageStatusValue" ELSE 'NOT_STARTED'::"StageStatusValue" END,
  NOW(), NOW()
FROM "PipelineStage" s
WHERE s."isActive" = true
ON CONFLICT ("trackingId", "stageId") DO NOTHING;

-- Stage statuses for Company 2 (teaser done, nda in progress)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt", "createdAt", "updatedAt")
SELECT 'test_tr_2', s."id",
  CASE
    WHEN s."key" = 'teaser' THEN 'COMPLETED'::"StageStatusValue"
    WHEN s."key" = 'nda' THEN 'IN_PROGRESS'::"StageStatusValue"
    ELSE 'NOT_STARTED'::"StageStatusValue"
  END,
  CASE WHEN s."key" = 'teaser' THEN NOW() - INTERVAL '2 days' ELSE NULL END,
  NOW(), NOW()
FROM "PipelineStage" s
WHERE s."isActive" = true
ON CONFLICT ("trackingId", "stageId") DO NOTHING;

-- Stage statuses for Company 3 (teaser done, nda COMPLETED but NOT approved)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt", "createdAt", "updatedAt")
SELECT 'test_tr_3', s."id",
  CASE
    WHEN s."key" = 'teaser' THEN 'COMPLETED'::"StageStatusValue"
    WHEN s."key" = 'nda' THEN 'COMPLETED'::"StageStatusValue"
    ELSE 'NOT_STARTED'::"StageStatusValue"
  END,
  CASE
    WHEN s."key" = 'teaser' THEN NOW() - INTERVAL '3 days'
    WHEN s."key" = 'nda' THEN NOW() - INTERVAL '1 day'
    ELSE NULL
  END,
  NOW(), NOW()
FROM "PipelineStage" s
WHERE s."isActive" = true
ON CONFLICT ("trackingId", "stageId") DO NOTHING;

-- Stage statuses for Company 4 (teaser + nda approved, im in progress)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt", "approvedAt", "approvedByUserId", "createdAt", "updatedAt")
SELECT 'test_tr_4', s."id",
  CASE
    WHEN s."key" IN ('teaser', 'nda') THEN 'COMPLETED'::"StageStatusValue"
    WHEN s."key" = 'im' THEN 'IN_PROGRESS'::"StageStatusValue"
    ELSE 'NOT_STARTED'::"StageStatusValue"
  END,
  CASE
    WHEN s."key" = 'teaser' THEN NOW() - INTERVAL '5 days'
    WHEN s."key" = 'nda' THEN NOW() - INTERVAL '3 days'
    ELSE NULL
  END,
  CASE WHEN s."key" = 'nda' THEN NOW() - INTERVAL '2 days' ELSE NULL END,
  CASE WHEN s."key" = 'nda' THEN (SELECT "id" FROM "User" WHERE "email" = 'admin@example.com' LIMIT 1) ELSE NULL END,
  NOW(), NOW()
FROM "PipelineStage" s
WHERE s."isActive" = true
ON CONFLICT ("trackingId", "stageId") DO NOTHING;

-- Stage statuses for Company 5 (dropped — nothing completed)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "createdAt", "updatedAt")
SELECT 'test_tr_5', s."id", 'NOT_STARTED'::"StageStatusValue", NOW(), NOW()
FROM "PipelineStage" s
WHERE s."isActive" = true
ON CONFLICT ("trackingId", "stageId") DO NOTHING;

COMMIT;

-- ===============================================================
-- SECTION 5: CREATE TEST INVESTOR USER
-- ===============================================================
-- Test investor for Company 1 (fresh journey starting at teaser)
-- Password: testtest123 (bcrypt hashed)

BEGIN;

INSERT INTO "User" (
  "id", "name", "email", "passwordHash", "role", "isActive",
  "companyId", "createdAt", "updatedAt"
) VALUES (
  'test_user_investor_1',
  'Anna van Dijk (Test Investor)',
  'anna@test.dils.com',
  '$2a$12$8J5Kw3tM9.PZnUX.vN3BJupvZxH5rN6e0eBpQXn4cK2Pk8GxjY1hW',
  'INVESTOR',
  true,
  'test_co_1',
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "companyId" = EXCLUDED."companyId",
  "isActive" = true,
  "updatedAt" = NOW();

-- Test investor for Company 4 (IM unlocked — see full investor experience)
INSERT INTO "User" (
  "id", "name", "email", "passwordHash", "role", "isActive",
  "companyId", "createdAt", "updatedAt"
) VALUES (
  'test_user_investor_4',
  'Daan Meijer (Test Investor)',
  'daan@test.dils.com',
  '$2a$12$8J5Kw3tM9.PZnUX.vN3BJupvZxH5rN6e0eBpQXn4cK2Pk8GxjY1hW',
  'INVESTOR',
  true,
  'test_co_4',
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "companyId" = EXCLUDED."companyId",
  "isActive" = true,
  "updatedAt" = NOW();

COMMIT;

-- ===============================================================
-- SECTION 6: SAMPLE COMMENTS
-- ===============================================================

BEGIN;

INSERT INTO "Comment" ("trackingId", "authorUserId", "body", "createdAt", "updatedAt")
SELECT 'test_tr_2', (SELECT "id" FROM "User" WHERE "email" = 'admin@example.com' LIMIT 1),
  'Teaser reviewed by Bravo. They''re requesting the NDA this week.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM "Comment" WHERE "trackingId" = 'test_tr_2' LIMIT 1);

INSERT INTO "Comment" ("trackingId", "authorUserId", "body", "createdAt", "updatedAt")
SELECT 'test_tr_3', (SELECT "id" FROM "User" WHERE "email" = 'admin@example.com' LIMIT 1),
  'Charlie Holdings signed the NDA. Waiting on our internal review before unlocking IM.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM "Comment" WHERE "trackingId" = 'test_tr_3' LIMIT 1);

INSERT INTO "Comment" ("trackingId", "authorUserId", "body", "createdAt", "updatedAt")
SELECT 'test_tr_4', (SELECT "id" FROM "User" WHERE "email" = 'admin@example.com' LIMIT 1),
  'Delta has access to IM. Scheduling viewing next week.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM "Comment" WHERE "trackingId" = 'test_tr_4' LIMIT 1);

COMMIT;

-- ===============================================================
-- SECTION 7: VERIFY TEST DATA
-- ===============================================================
-- Run these to confirm the setup worked

-- Should return 1 test asset
SELECT "id", "title", "city" FROM "Asset" WHERE "id" = 'test_asset_001';

-- Should return 5 test companies
SELECT "id", "name", "contactEmail" FROM "Company" WHERE "id" LIKE 'test_co_%' ORDER BY "id";

-- Should return 5 tracking rows with different stages
SELECT
  t."id",
  c."name" AS company,
  t."currentStageKey",
  t."lifecycleStatus",
  t."interestLevel"
FROM "AssetCompanyTracking" t
JOIN "Company" c ON t."companyId" = c."id"
WHERE t."assetId" = 'test_asset_001'
ORDER BY t."id";

-- Should return stage status grid (each tracking has 5 stage statuses)
SELECT
  t."id" AS tracking,
  s."label" AS stage,
  ss."status",
  ss."completedAt" IS NOT NULL AS completed,
  ss."approvedAt" IS NOT NULL AS approved
FROM "StageStatus" ss
JOIN "AssetCompanyTracking" t ON ss."trackingId" = t."id"
JOIN "PipelineStage" s ON ss."stageId" = s."id"
WHERE t."assetId" = 'test_asset_001'
ORDER BY t."id", s."sequence";

-- Should return 2 test investor users
SELECT "email", "role", "isActive", "companyId"
FROM "User"
WHERE "email" LIKE '%@test.dils.com';

-- ===============================================================
-- SECTION 8: QUICK DIAGNOSTIC QUERIES
-- ===============================================================
-- Useful for debugging during test runs

-- Show all documents for test asset
SELECT d."id", d."fileName", d."status", d."placementMode", t."id" AS trackingId, c."name" AS company
FROM "Document" d
JOIN "AssetCompanyTracking" t ON d."trackingId" = t."id"
JOIN "Company" c ON t."companyId" = c."id"
WHERE t."assetId" = 'test_asset_001';

-- Show all invites for test asset
SELECT i."email", c."name" AS company, i."acceptedAt", i."expiresAt"
FROM "InvestorInvite" i
JOIN "Company" c ON i."companyId" = c."id"
WHERE i."assetId" = 'test_asset_001'
ORDER BY i."createdAt" DESC;

-- Check for broken data (NULL fileUrls, orphans)
SELECT 'AssetContent with NULL fileUrl' AS issue, COUNT(*) AS count
FROM "AssetContent" WHERE "fileUrl" IS NULL AND "contentType" = 'PDF'
UNION ALL
SELECT 'Documents with NULL fileUrl', COUNT(*)
FROM "Document" WHERE "fileUrl" IS NULL
UNION ALL
SELECT 'Trackings without stage statuses', COUNT(*)
FROM "AssetCompanyTracking" t
WHERE NOT EXISTS (SELECT 1 FROM "StageStatus" WHERE "trackingId" = t."id");

-- ===============================================================
-- TEST LOGIN CREDENTIALS
-- ===============================================================
-- Admin:      admin@example.com       / password123
-- Editor:     editor@example.com      / password123
-- Investor 1: anna@test.dils.com      / testtest123  (fresh journey)
-- Investor 4: daan@test.dils.com      / testtest123  (IM unlocked)
-- ===============================================================
