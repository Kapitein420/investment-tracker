-- Sprint B PR-1: UserCompanyMembership join table (additive).
--
-- Apply once in Supabase SQL editor against production. After this runs,
-- the `npx prisma generate` step in the next deploy will pick up the new
-- model. No data migration here — every read still resolves through the
-- legacy User.companyId scalar until PR-3/PR-4 backfill.
--
-- This script is idempotent: re-running creates nothing new.

CREATE TABLE IF NOT EXISTS "UserCompanyMembership" (
  "id"        TEXT        PRIMARY KEY,
  "userId"    TEXT        NOT NULL,
  "companyId" TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCompanyMembership_userId_fkey"
    FOREIGN KEY ("userId")    REFERENCES "User"("id")    ON DELETE CASCADE,
  CONSTRAINT "UserCompanyMembership_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserCompanyMembership_userId_companyId_key"
  ON "UserCompanyMembership" ("userId", "companyId");

CREATE INDEX IF NOT EXISTS "UserCompanyMembership_userId_idx"
  ON "UserCompanyMembership" ("userId");

CREATE INDEX IF NOT EXISTS "UserCompanyMembership_companyId_idx"
  ON "UserCompanyMembership" ("companyId");
