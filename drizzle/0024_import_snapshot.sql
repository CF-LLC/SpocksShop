-- Marketplace sync (additive only): remember what Depop/Vinted said at the last sync, so a later
-- source change never silently overwrites a field Cooper edited in admin (it is flagged instead).
ALTER TABLE "product_imports" ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb;
