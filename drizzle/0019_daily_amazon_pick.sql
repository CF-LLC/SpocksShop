-- Daily Amazon pick (additive only).
ALTER TABLE "affiliate_items" ADD COLUMN IF NOT EXISTS "why" text;
CREATE TABLE IF NOT EXISTS "daily_amazon_picks" (
  "pick_date" date PRIMARY KEY,
  "affiliate_item_id" uuid REFERENCES "affiliate_items"("id") ON DELETE SET NULL,
  "cycle" integer NOT NULL DEFAULT 1,
  "why" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "daily_amazon_picks_item_idx" ON "daily_amazon_picks" ("affiliate_item_id");
