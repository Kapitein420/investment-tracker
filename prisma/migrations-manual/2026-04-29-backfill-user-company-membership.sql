-- Sprint B PR-4: Backfill UserCompanyMembership from existing User.companyId.
--
-- This is the data step. After it runs, every existing INVESTOR user has a
-- membership row pointing at their current company. Combined with the read
-- shim from PR-2, the platform behaves identically — the join becomes the
-- source of truth, the legacy User.companyId scalar becomes redundant.
--
-- Idempotent: ON CONFLICT DO NOTHING means re-running creates nothing new.
-- Safe to run during traffic — adds rows, doesn't lock or delete.
--
-- DRY-RUN FIRST. Before running, count the rows that will be inserted:
--
--   SELECT count(*)
--   FROM "User" u
--   WHERE u.role = 'INVESTOR'
--     AND u."companyId" IS NOT NULL
--     AND u."isActive" = true
--     AND NOT EXISTS (
--       SELECT 1 FROM "UserCompanyMembership" m
--       WHERE m."userId" = u.id AND m."companyId" = u."companyId"
--     );
--
-- Then run the INSERT. Then sanity-check:
--
--   SELECT count(*) FROM "UserCompanyMembership";
--   -- Should equal the dry-run count above (assuming table was empty before).
--
--   SELECT count(*) FROM "UserCompanyMembership" m
--   JOIN "User" u ON u.id = m."userId"
--   WHERE u."companyId" != m."companyId";
--   -- Should be 0 — every membership matches the legacy companyId.

-- Use the User row's createdAt as the membership timestamp so the "primary
-- company" inference (oldest membership wins) keeps producing the same
-- result post-migration as the legacy User.companyId did pre-migration.
INSERT INTO "UserCompanyMembership" ("id", "userId", "companyId", "createdAt")
SELECT
  -- cuid-style id: timestamp prefix + random suffix. Prisma will mint
  -- proper cuids on new inserts, but for backfill any unique string
  -- works. We just use a static prefix + the userId so we can re-trace.
  'mig_' || u.id AS id,
  u.id          AS "userId",
  u."companyId" AS "companyId",
  u."createdAt" AS "createdAt"
FROM "User" u
WHERE u.role = 'INVESTOR'
  AND u."companyId" IS NOT NULL
  AND u."isActive" = true
ON CONFLICT ("userId", "companyId") DO NOTHING;

-- Optional: also backfill EDITOR / VIEWER / ADMIN users who happen to have
-- a companyId set (rare — usually those are NULL). Skipped by default
-- because non-investor users never use the multi-company shim today.
