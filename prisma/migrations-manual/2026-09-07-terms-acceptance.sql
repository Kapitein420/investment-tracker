-- Portal terms-of-use click-accept evidence (compliance gap G13).
--
-- TermsAcceptance records the version, timestamp, IP and user agent of an
-- investor's click-accept of the DILS general terms (linked from the portal
-- footer, https://dils.nl/algemene-voorwaarden/ — no new legal text). BW
-- 6:234 wants terms presented before contracting and retrievable afterwards;
-- a click-accept on first login is routine and binding on business users.
--
-- The unique (userId, termsVersion) pair makes recordTermsAcceptance() an
-- idempotent upsert: re-accepting the same version never creates a second
-- row, and a future TERMS_VERSION bump (src/lib/terms.ts) asks again without
-- touching the evidence already on file for the old version.
--
-- Apply once in the Supabase SQL editor against production, BEFORE the
-- deploy — the investor portal layout reads this table on every request for
-- an INVESTOR session. After this runs, the next deploy's `prisma generate`
-- step picks up the new model. Existing investors will simply be asked to
-- accept once on their next portal visit.
--
-- Idempotent: re-running creates nothing new and never errors.

CREATE TABLE IF NOT EXISTS "TermsAcceptance" (
  "id"           TEXT         PRIMARY KEY,
  "userId"       TEXT         NOT NULL,
  "termsVersion" TEXT         NOT NULL,
  "acceptedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip"           TEXT,
  "userAgent"    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "TermsAcceptance_userId_termsVersion_key"
  ON "TermsAcceptance" ("userId", "termsVersion");

DO $$ BEGIN
  ALTER TABLE "TermsAcceptance"
    ADD CONSTRAINT "TermsAcceptance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS, matching every other public table (see supabase-rls-policies.sql):
-- the app connects with the service-role key, which bypasses RLS; anon must
-- see nothing. The role check keeps this file runnable against a bare local
-- Postgres, where `anon` is a Supabase-only role.
ALTER TABLE "TermsAcceptance" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE POLICY deny_anon_all ON "TermsAcceptance"
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
