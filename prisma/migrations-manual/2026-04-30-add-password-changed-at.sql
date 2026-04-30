-- Force-change-on-first-login support: track when the user last set their
-- own password. NULL means the current hash was set by an admin / system
-- flow and the user must change it before they can use the portal.
--
-- Existing rows are backfilled with createdAt so the deploy doesn't
-- accidentally trap every active user on the change-password page. Any
-- subsequent password rotation (admin reset, /forgot-password,
-- /request-access) explicitly sets this column back to NULL via the
-- application code.
--
-- Run this in Supabase SQL Editor BEFORE merging the corresponding code
-- PR — otherwise Prisma will throw "Unknown field passwordChangedAt" on
-- every User query.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

UPDATE "User"
  SET "passwordChangedAt" = "createdAt"
  WHERE "passwordChangedAt" IS NULL;
