-- Seller terms acceptance (additive only).
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamptz;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "terms_version" text;
