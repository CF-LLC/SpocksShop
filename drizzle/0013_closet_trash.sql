-- Soft-delete Trash for Closet Picks (additive only). A trashed item has status 'trashed',
-- remembers the status it had, and is only purged by an explicit "Empty trash".
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "trashed_at" timestamptz;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "trashed_from_status" text;
CREATE INDEX IF NOT EXISTS "products_source_status_idx" ON "products" ("source", "status");
