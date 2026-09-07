-- One-time set-password links + account lockout (compliance gap G9).
--
-- PasswordSetToken replaces the plaintext passwords that the invite,
-- welcome, reset and admin-reset emails used to carry. Only the SHA-256 of
-- the token is stored: the raw value lives in the email (and in Mailgun's
-- logs) for days, so a database leak must not yield working links. Tokens
-- are single-use — the claim is an UPDATE ... WHERE "usedAt" IS NULL, so two
-- concurrent redemptions can never both win.
--
-- User gains the two lockout counters read by the NextAuth authorize path:
-- 10 failed passwords inside an unexpired window set "lockedUntil" to
-- now + 15 minutes and reset the counter. Existing rows default to 0 / NULL,
-- i.e. not locked, so no user is affected by the deploy.
--
-- Apply once in the Supabase SQL editor against production, BEFORE the
-- deploy — the app reads these columns on every login. After this runs, the
-- next deploy's `prisma generate` step picks up the new model.
--
-- Idempotent: re-running creates nothing new and never errors.

CREATE TABLE IF NOT EXISTS "PasswordSetToken" (
  "id"        TEXT         PRIMARY KEY,
  "userId"    TEXT         NOT NULL,
  "tokenHash" TEXT         NOT NULL,
  "purpose"   TEXT         NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordSetToken_tokenHash_key"
  ON "PasswordSetToken" ("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordSetToken_userId_idx"
  ON "PasswordSetToken" ("userId");

DO $$ BEGIN
  ALTER TABLE "PasswordSetToken"
    ADD CONSTRAINT "PasswordSetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS, matching every other public table (see supabase-rls-policies.sql):
-- the app connects with the service-role key, which bypasses RLS; anon must
-- see nothing. Doubly important here — the rows are auth material.
-- The role check keeps this file runnable against a bare local Postgres,
-- where `anon` is a Supabase-only role.
ALTER TABLE "PasswordSetToken" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE POLICY deny_anon_all ON "PasswordSetToken"
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
