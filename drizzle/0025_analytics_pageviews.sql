-- Analytics v2 (additive only): page views + add-to-cart events, privacy-friendly visitor counting,
-- referrer source/search term, test tagging, daily rollups for raw rows older than 90 days.
-- Widens the event-name CHECK (no rows, columns or tables are changed or removed).
ALTER TABLE "analytics_events" DROP CONSTRAINT IF EXISTS "analytics_events_name_check";--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_name_check" CHECK ("name" IN ('product_view', 'amazon_click', 'checkout_start', 'page_view', 'add_to_cart'));--> statement-breakpoint
-- Daily-rotating salted hash (16 hex chars), never an IP; resets every day so visitors can't be followed across days.
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "visitor" text;--> statement-breakpoint
-- Referrer host only (e.g. google.com), never the full URL.
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "source" text;--> statement-breakpoint
-- Search term when the referrer carried one in its query string (rare: most engines strip it).
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "term" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "test" boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_created_idx" ON "analytics_events" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_name_path_created_idx" ON "analytics_events" ("name", "path", "created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_daily" (
  "day" date NOT NULL,
  "name" text NOT NULL,
  "path" text NOT NULL DEFAULT '',
  "source" text NOT NULL DEFAULT '',
  "n" integer NOT NULL DEFAULT 0,
  "visitors" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("day", "name", "path", "source")
);
