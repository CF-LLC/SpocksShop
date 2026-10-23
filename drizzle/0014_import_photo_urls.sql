-- Re-import updates existing items (additive only): remember which Depop photos an import used.
ALTER TABLE "product_imports" ADD COLUMN IF NOT EXISTS "photo_urls" jsonb;
ALTER TABLE "product_imports" ADD COLUMN IF NOT EXISTS "synced_at" timestamptz;
