-- EmailSuppression: recipients who unsubscribed or complained. Checked
-- before every commercial send (Telecommunicatiewet 11.7 lid 4).
--
-- Apply once in the Supabase SQL editor against production. After this
-- runs, the next deploy's `prisma generate` step picks up the new model.
--
-- Idempotent: re-running creates nothing new and never errors.

DO $$ BEGIN
  CREATE TYPE "EmailSuppressionReason" AS ENUM ('UNSUBSCRIBED', 'COMPLAINED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "EmailSuppression" (
  "id"        TEXT                     PRIMARY KEY,
  "email"     TEXT                     NOT NULL,
  "reason"    "EmailSuppressionReason" NOT NULL,
  "source"    TEXT                     NOT NULL,
  "createdAt" TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailSuppression_email_key"
  ON "EmailSuppression" ("email");
