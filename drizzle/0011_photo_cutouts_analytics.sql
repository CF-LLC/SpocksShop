-- Background removal on already-uploaded photos keeps the original so it can be reverted.
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "original_storage_path" text;
--> statement-breakpoint
-- First-party, cookieless event counts (no IPs, no user ids, no PII).
CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" bigserial PRIMARY KEY,
  "name" text NOT NULL CHECK ("name" IN ('product_view', 'amazon_click', 'checkout_start')),
  "path" text,
  "ref" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_name_created_idx" ON "analytics_events" ("name", "created_at");
