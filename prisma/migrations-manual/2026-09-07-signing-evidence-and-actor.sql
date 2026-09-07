-- Fix signing-audit attribution (compliance gap G8) and persist signing
-- evidence that was previously discarded.
--
-- Today, StageHistory.changedByUserId and ActivityLog.userId are written as
-- the admin who *uploaded* the document, not the person who actually signed
-- it — so audit rows credit the wrong actor for every DOCUMENT_SIGNED event.
-- The real actor is the session user when the signer is logged in (investor
-- portal), but on the anonymous /sign/[token] page there is no session at
-- all, so both columns need to allow NULL and fall back to the signing
-- token id recorded in ActivityLog.metadata for attribution.
--
-- A system User row was considered and rejected: no read path joins
-- ActivityLog -> User, only two UI lines read StageHistory.changedBy (both
-- already null-safe or easy to make so), and a system row would need a
-- non-loginable account plus filtering out of the admin user list — more
-- surface area than making the actor nullable.
--
-- Document also gains three columns to stop discarding signing evidence:
-- signerIp / signerUserAgent (request metadata captured at sign time) and
-- pdfSha256 (hash of the bytes at signedFileUrl, for tamper-evidence).
--
-- Apply once in the Supabase SQL editor against production. After this
-- runs, the next deploy's `prisma generate` step picks up the new fields.
--
-- Idempotent: re-running creates nothing new and never errors.

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "signerIp" TEXT,
  ADD COLUMN IF NOT EXISTS "signerUserAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfSha256" TEXT;

ALTER TABLE "ActivityLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "StageHistory" ALTER COLUMN "changedByUserId" DROP NOT NULL;
