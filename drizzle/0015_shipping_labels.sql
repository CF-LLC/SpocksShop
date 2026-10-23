-- USPS labels via Shippo (additive only).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipped_at" timestamptz;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_number" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_carrier" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_url" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_email_sent_at" timestamptz;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_quote" jsonb;
CREATE TABLE IF NOT EXISTS "shipping_labels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'purchasing',
  "provider" text NOT NULL DEFAULT 'shippo',
  "rate_id" text NOT NULL,
  "transaction_id" text,
  "carrier" text,
  "service" text,
  "amount_cents" integer,
  "label_url" text,
  "tracking_number" text,
  "tracking_url" text,
  "error" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
-- At most one in-flight or bought label per order: a double click can't buy twice.
CREATE UNIQUE INDEX IF NOT EXISTS "shipping_labels_one_active" ON "shipping_labels" ("order_id") WHERE "status" IN ('purchasing', 'purchased');
