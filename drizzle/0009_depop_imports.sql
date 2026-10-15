-- Depop link importer: remembers which Depop listing each imported draft came from.
-- Internal only: no public query reads this table, so shoppers never see a Depop link. Additive only.
CREATE TABLE IF NOT EXISTS "product_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "source_url" text NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_imports_source_valid" CHECK ("source" in ('depop'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_imports_source_url_idx" ON "product_imports" ("source", "source_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_imports_product_idx" ON "product_imports" ("product_id");
