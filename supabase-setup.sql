-- ============================================================
-- INVESTMENT TRACKER — Full Schema + Seed Data
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ─── Enums ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CompanyType" AS ENUM ('INVESTOR', 'BROKER', 'ADVISOR', 'TENANT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StageStatusValue" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LifecycleStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED', 'ON_HOLD');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InterestLevel" AS ENUM ('HOT', 'WARM', 'COLD', 'NONE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── Tables ─────────────────────────────────────────────────

-- 1. User
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'VIEWER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- 2. Asset
CREATE TABLE IF NOT EXISTS "Asset" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "brokerLabel" TEXT,
  "assetType" TEXT,
  "transactionType" TEXT,
  "ownerEntity" TEXT,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3. Company
CREATE TABLE IF NOT EXISTS "Company" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "type" "CompanyType" NOT NULL DEFAULT 'INVESTOR',
  "website" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- 4. PipelineStage
CREATE TABLE IF NOT EXISTS "PipelineStage" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PipelineStage_key_key" ON "PipelineStage"("key");

-- 5. AssetCompanyTracking
CREATE TABLE IF NOT EXISTS "AssetCompanyTracking" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "assetId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL DEFAULT 'Investor',
  "currentStageKey" TEXT,
  "currentStageManualOverride" BOOLEAN NOT NULL DEFAULT false,
  "lifecycleStatus" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "interestLevel" "InterestLevel",
  "ownerUserId" TEXT,
  "priority" INTEGER,
  "latestCommentPreview" TEXT,
  "sortOrder" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetCompanyTracking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssetCompanyTracking_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssetCompanyTracking_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssetCompanyTracking_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssetCompanyTracking_assetId_companyId_key" ON "AssetCompanyTracking"("assetId", "companyId");

-- 6. StageStatus
CREATE TABLE IF NOT EXISTS "StageStatus" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "trackingId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "status" "StageStatusValue" NOT NULL DEFAULT 'NOT_STARTED',
  "completedAt" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StageStatus_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StageStatus_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "AssetCompanyTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StageStatus_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StageStatus_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StageStatus_trackingId_stageId_key" ON "StageStatus"("trackingId", "stageId");

-- 7. Comment
CREATE TABLE IF NOT EXISTS "Comment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "trackingId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Comment_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "AssetCompanyTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Comment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 8. StageHistory
CREATE TABLE IF NOT EXISTS "StageHistory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "trackingId" TEXT NOT NULL,
  "stageId" TEXT,
  "fieldName" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "changedByUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StageHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StageHistory_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "AssetCompanyTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StageHistory_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StageHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 9. ActivityLog
CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 10. SavedView
CREATE TABLE IF NOT EXISTS "SavedView" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "assetId" TEXT,
  "name" TEXT NOT NULL,
  "filterConfig" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SavedView_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================
-- SEED DATA
-- ============================================================
-- Passwords are bcrypt hash of "password123"

-- ─── Users ──────────────────────────────────────────────────
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive") VALUES
  ('user_admin', 'Noah Admin', 'admin@example.com', '$2a$10$YGL/yDiF1rImsk8x9NCJiuzLF68SkUtvInLrI9.yF9hnyGVbaNXqC', 'ADMIN', true),
  ('user_editor', 'Ezra Editor', 'editor@example.com', '$2a$10$YGL/yDiF1rImsk8x9NCJiuzLF68SkUtvInLrI9.yF9hnyGVbaNXqC', 'EDITOR', true),
  ('user_viewer', 'Sarah Viewer', 'viewer@example.com', '$2a$10$YGL/yDiF1rImsk8x9NCJiuzLF68SkUtvInLrI9.yF9hnyGVbaNXqC', 'VIEWER', true)
ON CONFLICT ("id") DO NOTHING;

-- ─── Pipeline Stages ────────────────────────────────────────
INSERT INTO "PipelineStage" ("id", "key", "label", "sequence") VALUES
  ('stage_teaser', 'teaser', 'Teaser', 0),
  ('stage_nda', 'nda', 'NDA', 1),
  ('stage_im', 'im', 'IM', 2),
  ('stage_viewing', 'viewing', 'Viewing', 3),
  ('stage_nbo', 'nbo', 'NBO', 4)
ON CONFLICT ("id") DO NOTHING;

-- ─── Asset ──────────────────────────────────────────────────
INSERT INTO "Asset" ("id", "title", "address", "city", "country", "brokerLabel", "assetType", "transactionType", "ownerEntity", "createdById") VALUES
  ('asset_1', 'Generaal Vetterstraat 82', 'Generaal Vetterstraat 82', 'Amsterdam', 'Netherlands', 'CBRE', 'Office', 'Investment Sale', 'Private Equity Fund', 'user_admin')
ON CONFLICT ("id") DO NOTHING;

-- ─── Companies ──────────────────────────────────────────────
INSERT INTO "Company" ("id", "name", "type") VALUES
  ('co_01', 'Uptown', 'INVESTOR'),
  ('co_02', 'Stoneweg', 'INVESTOR'),
  ('co_03', 'GreenRoad Capital', 'INVESTOR'),
  ('co_04', 'Dudok Real Estate', 'INVESTOR'),
  ('co_05', 'Cocon', 'INVESTOR'),
  ('co_06', 'Uijthoven', 'INVESTOR'),
  ('co_07', 'Atland Voisin', 'INVESTOR'),
  ('co_08', 'Jamestown', 'INVESTOR'),
  ('co_09', 'Sofidy', 'INVESTOR'),
  ('co_10', 'PingProperties', 'INVESTOR'),
  ('co_11', 'NSI', 'INVESTOR'),
  ('co_12', 'FLOW Real Estate', 'INVESTOR'),
  ('co_13', 'APF', 'INVESTOR'),
  ('co_14', 'Newomij', 'INVESTOR'),
  ('co_15', 'Remake', 'INVESTOR'),
  ('co_16', 'Corum', 'INVESTOR'),
  ('co_17', 'Edge', 'INVESTOR'),
  ('co_18', 'Edmond de Rothschild', 'INVESTOR')
ON CONFLICT ("id") DO NOTHING;

-- ─── Tracking Rows ──────────────────────────────────────────
INSERT INTO "AssetCompanyTracking" ("id", "assetId", "companyId", "relationshipType", "currentStageKey", "lifecycleStatus", "interestLevel", "ownerUserId", "latestCommentPreview") VALUES
  ('tr_01', 'asset_1', 'co_01', 'Investor', 'nbo',     'ACTIVE',    'HOT',  'user_admin',  'Very interested, reviewing final terms'),
  ('tr_02', 'asset_1', 'co_02', 'Investor', 'viewing', 'ACTIVE',    'HOT',  'user_admin',  'Viewing scheduled for next week'),
  ('tr_03', 'asset_1', 'co_03', 'Investor', 'im',      'ACTIVE',    'WARM', 'user_editor', 'Several questions have been answered, waiting for response'),
  ('tr_04', 'asset_1', 'co_04', 'Investor', 'im',      'ACTIVE',    'WARM', 'user_editor', 'Internal discussion this week'),
  ('tr_05', 'asset_1', 'co_05', 'Investor', 'nda',     'ACTIVE',    'WARM', NULL,          'Shared NDA and teaser'),
  ('tr_06', 'asset_1', 'co_06', 'Advisor',  'nda',     'ACTIVE',    'COLD', NULL,          'Sent to contact'),
  ('tr_07', 'asset_1', 'co_07', 'Investor', 'viewing', 'ACTIVE',    'HOT',  'user_admin',  'Strong interest, scheduling second viewing'),
  ('tr_08', 'asset_1', 'co_08', 'Investor', 'teaser',  'ACTIVE',    'COLD', NULL,          'Waiting for response'),
  ('tr_09', 'asset_1', 'co_09', 'Investor', 'im',      'ACTIVE',    'WARM', 'user_editor', 'Reviewing IM documentation'),
  ('tr_10', 'asset_1', 'co_10', 'Investor', 'nda',     'DROPPED',   'NONE', NULL,          'Not interested'),
  ('tr_11', 'asset_1', 'co_11', 'Investor', 'nbo',     'COMPLETED', 'HOT',  'user_admin',  'NBO submitted and accepted'),
  ('tr_12', 'asset_1', 'co_12', 'Advisor',  'teaser',  'ACTIVE',    'WARM', 'user_editor', 'Sent to contact'),
  ('tr_13', 'asset_1', 'co_13', 'Investor', 'teaser',  'DROPPED',   'NONE', NULL,          'Value-add element is too small'),
  ('tr_14', 'asset_1', 'co_14', 'Investor', 'im',      'ON_HOLD',   'COLD', NULL,          'Too involved in own projects'),
  ('tr_15', 'asset_1', 'co_15', 'Investor', 'nda',     'DROPPED',   'NONE', NULL,          'Declined after reviewing teaser'),
  ('tr_16', 'asset_1', 'co_16', 'Investor', 'viewing', 'ACTIVE',    'WARM', 'user_admin',  'Viewing completed, awaiting feedback'),
  ('tr_17', 'asset_1', 'co_17', 'Advisor',  'nda',     'ACTIVE',    'COLD', 'user_editor', 'NDA in review with legal'),
  ('tr_18', 'asset_1', 'co_18', 'Investor', 'nbo',     'ACTIVE',    'HOT',  'user_admin',  'Preparing NBO, strong interest')
ON CONFLICT ("id") DO NOTHING;

-- ─── Stage Statuses (5 per tracking row = 90 total) ─────────

-- tr_01: Uptown — at NBO stage (all completed up to viewing, nbo in progress)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_01', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '30 days'),
  ('tr_01', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '25 days'),
  ('tr_01', 'stage_im',      'COMPLETED', NOW() - INTERVAL '18 days'),
  ('tr_01', 'stage_viewing', 'COMPLETED', NOW() - INTERVAL '10 days'),
  ('tr_01', 'stage_nbo',     'IN_PROGRESS', NULL);

-- tr_02: Stoneweg — at Viewing stage
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_02', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '28 days'),
  ('tr_02', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '22 days'),
  ('tr_02', 'stage_im',      'COMPLETED', NOW() - INTERVAL '14 days'),
  ('tr_02', 'stage_viewing', 'IN_PROGRESS', NULL),
  ('tr_02', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_03: GreenRoad Capital — at IM stage
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_03', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '26 days'),
  ('tr_03', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '20 days'),
  ('tr_03', 'stage_im',      'IN_PROGRESS', NULL),
  ('tr_03', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_03', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_04: Dudok Real Estate — at IM stage
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_04', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '24 days'),
  ('tr_04', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '18 days'),
  ('tr_04', 'stage_im',      'IN_PROGRESS', NULL),
  ('tr_04', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_04', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_05: Cocon — at NDA stage
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_05', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '20 days'),
  ('tr_05', 'stage_nda',     'IN_PROGRESS', NULL),
  ('tr_05', 'stage_im',      'NOT_STARTED', NULL),
  ('tr_05', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_05', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_06: Uijthoven — at NDA stage (advisor)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_06', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '22 days'),
  ('tr_06', 'stage_nda',     'IN_PROGRESS', NULL),
  ('tr_06', 'stage_im',      'NOT_STARTED', NULL),
  ('tr_06', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_06', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_07: Atland Voisin — at Viewing stage
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_07', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '27 days'),
  ('tr_07', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '21 days'),
  ('tr_07', 'stage_im',      'COMPLETED', NOW() - INTERVAL '13 days'),
  ('tr_07', 'stage_viewing', 'IN_PROGRESS', NULL),
  ('tr_07', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_08: Jamestown — just teaser
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_08', 'stage_teaser',  'IN_PROGRESS', NULL),
  ('tr_08', 'stage_nda',     'NOT_STARTED', NULL),
  ('tr_08', 'stage_im',      'NOT_STARTED', NULL),
  ('tr_08', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_08', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_09: Sofidy — at IM stage
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_09', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '25 days'),
  ('tr_09', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '19 days'),
  ('tr_09', 'stage_im',      'IN_PROGRESS', NULL),
  ('tr_09', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_09', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_10: PingProperties — dropped at NDA
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_10', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '21 days'),
  ('tr_10', 'stage_nda',     'DECLINED', NULL),
  ('tr_10', 'stage_im',      'NOT_STARTED', NULL),
  ('tr_10', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_10', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_11: NSI — completed (all stages done)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_11', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '35 days'),
  ('tr_11', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '30 days'),
  ('tr_11', 'stage_im',      'COMPLETED', NOW() - INTERVAL '22 days'),
  ('tr_11', 'stage_viewing', 'COMPLETED', NOW() - INTERVAL '15 days'),
  ('tr_11', 'stage_nbo',     'COMPLETED', NOW() - INTERVAL '7 days');

-- tr_12: FLOW Real Estate — just teaser (advisor)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_12', 'stage_teaser',  'IN_PROGRESS', NULL),
  ('tr_12', 'stage_nda',     'NOT_STARTED', NULL),
  ('tr_12', 'stage_im',      'NOT_STARTED', NULL),
  ('tr_12', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_12', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_13: APF — dropped at teaser
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_13', 'stage_teaser',  'DECLINED', NULL),
  ('tr_13', 'stage_nda',     'NOT_STARTED', NULL),
  ('tr_13', 'stage_im',      'NOT_STARTED', NULL),
  ('tr_13', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_13', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_14: Newomij — on hold at IM
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_14', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '23 days'),
  ('tr_14', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '17 days'),
  ('tr_14', 'stage_im',      'BLOCKED', NULL),
  ('tr_14', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_14', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_15: Remake — dropped, declined NDA
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_15', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '19 days'),
  ('tr_15', 'stage_nda',     'DECLINED', NULL),
  ('tr_15', 'stage_im',      'NOT_STARTED', NULL),
  ('tr_15', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_15', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_16: Corum — at Viewing
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_16', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '29 days'),
  ('tr_16', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '23 days'),
  ('tr_16', 'stage_im',      'COMPLETED', NOW() - INTERVAL '15 days'),
  ('tr_16', 'stage_viewing', 'COMPLETED', NOW() - INTERVAL '8 days'),
  ('tr_16', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_17: Edge — NDA stage (advisor)
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_17', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '18 days'),
  ('tr_17', 'stage_nda',     'IN_PROGRESS', NULL),
  ('tr_17', 'stage_im',      'NOT_STARTED', NULL),
  ('tr_17', 'stage_viewing', 'NOT_STARTED', NULL),
  ('tr_17', 'stage_nbo',     'NOT_STARTED', NULL);

-- tr_18: Edmond de Rothschild — at NBO
INSERT INTO "StageStatus" ("trackingId", "stageId", "status", "completedAt") VALUES
  ('tr_18', 'stage_teaser',  'COMPLETED', NOW() - INTERVAL '32 days'),
  ('tr_18', 'stage_nda',     'COMPLETED', NOW() - INTERVAL '26 days'),
  ('tr_18', 'stage_im',      'COMPLETED', NOW() - INTERVAL '18 days'),
  ('tr_18', 'stage_viewing', 'COMPLETED', NOW() - INTERVAL '11 days'),
  ('tr_18', 'stage_nbo',     'IN_PROGRESS', NULL);

-- ─── Comments ───────────────────────────────────────────────
INSERT INTO "Comment" ("trackingId", "authorUserId", "body") VALUES
  ('tr_01', 'user_admin',  'Very interested, reviewing final terms'),
  ('tr_01', 'user_editor', 'Had a productive call, moving to NBO preparation'),
  ('tr_02', 'user_admin',  'Viewing scheduled for next week'),
  ('tr_02', 'user_editor', 'Requested additional floor plans before viewing'),
  ('tr_03', 'user_editor', 'Several questions have been answered, waiting for response'),
  ('tr_04', 'user_editor', 'Internal discussion this week'),
  ('tr_04', 'user_admin',  'Follow up scheduled with their investment committee'),
  ('tr_05', 'user_admin',  'Shared NDA and teaser'),
  ('tr_06', 'user_editor', 'Sent to contact'),
  ('tr_07', 'user_admin',  'Strong interest, scheduling second viewing'),
  ('tr_07', 'user_editor', 'First viewing went very well'),
  ('tr_08', 'user_editor', 'Waiting for response'),
  ('tr_09', 'user_editor', 'Reviewing IM documentation'),
  ('tr_10', 'user_admin',  'Not interested'),
  ('tr_11', 'user_admin',  'NBO submitted and accepted'),
  ('tr_11', 'user_editor', 'Deal completed successfully'),
  ('tr_12', 'user_editor', 'Sent to contact'),
  ('tr_13', 'user_admin',  'Value-add element is too small'),
  ('tr_14', 'user_editor', 'Too involved in own projects'),
  ('tr_15', 'user_admin',  'Declined after reviewing teaser'),
  ('tr_16', 'user_admin',  'Viewing completed, awaiting feedback'),
  ('tr_16', 'user_editor', 'Positive initial response from their team'),
  ('tr_17', 'user_editor', 'NDA in review with legal'),
  ('tr_18', 'user_admin',  'Preparing NBO, strong interest'),
  ('tr_18', 'user_editor', 'Multiple calls completed, very engaged');

-- Done!
SELECT 'Schema and seed data created successfully' AS result;
