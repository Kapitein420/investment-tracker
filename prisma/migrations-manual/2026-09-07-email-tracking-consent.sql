-- EmailTrackingConsent: recipients who opted in to Mailgun open/click
-- tracking via portal preferences (Telecommunicatiewet 11.7a / ePrivacy
-- Art. 5(3) — the open pixel and link rewriting read the recipient's
-- device, so tracking needs prior consent). Checked by sendEmail() before
-- every send; consent is active iff revokedAt IS NULL.
--
-- Apply once in the Supabase SQL editor against production. After this
-- runs, the next deploy's `prisma generate` step picks up the new model.
--
-- Idempotent: re-running creates nothing new and never errors.

CREATE TABLE IF NOT EXISTS "EmailTrackingConsent" (
  "id"            TEXT         PRIMARY KEY,
  "email"         TEXT         NOT NULL,
  "userId"        TEXT,
  "grantedAt"     TIMESTAMP(3) NOT NULL,
  "revokedAt"     TIMESTAMP(3),
  "noticeVersion" TEXT         NOT NULL,
  "source"        TEXT         NOT NULL,
  "ip"            TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailTrackingConsent_email_key"
  ON "EmailTrackingConsent" ("email");

-- RLS, matching every other public table (see supabase-rls-policies.sql):
-- the app connects with the service-role key, which bypasses RLS; anon must
-- see nothing. Idempotent.
ALTER TABLE "EmailTrackingConsent" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_anon_all ON "EmailTrackingConsent"
    FOR ALL TO anon USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
