-- Vinted link importer: allow 'vinted' as an import source next to 'depop'.
-- Widens the CHECK only (no rows, columns or tables are changed or removed).
ALTER TABLE "product_imports" DROP CONSTRAINT IF EXISTS "product_imports_source_valid";--> statement-breakpoint
ALTER TABLE "product_imports" ADD CONSTRAINT "product_imports_source_valid" CHECK ("source" in ('depop', 'vinted'));
