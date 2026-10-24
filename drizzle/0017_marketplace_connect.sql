-- Community seller marketplace (Stripe Connect, separate charges and transfers). Additive only.
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "stripe_account_id" text;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "connect_status" text NOT NULL DEFAULT 'not_started';
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "transfers_active" boolean NOT NULL DEFAULT false;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "requirements_due" integer NOT NULL DEFAULT 0;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "connect_synced_at" timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS "sellers_stripe_account_unique" ON "sellers" ("stripe_account_id") WHERE "stripe_account_id" IS NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "seller_id" uuid REFERENCES "sellers"("id") ON DELETE SET NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "platform_fee_cents" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamptz;
CREATE INDEX IF NOT EXISTS "orders_seller_idx" ON "orders" ("seller_id") WHERE "seller_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "seller_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE RESTRICT,
  "seller_id" uuid NOT NULL REFERENCES "sellers"("id") ON DELETE RESTRICT,
  "gross_cents" integer NOT NULL,
  "fee_cents" integer NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'usd',
  "status" text NOT NULL DEFAULT 'held',
  "hold_reason" text,
  "payment_intent_id" text,
  "charge_id" text,
  "transfer_group" text NOT NULL,
  "delivered_at" timestamptz,
  "delivered_source" text,
  "release_after" timestamptz,
  "transfer_id" text,
  "transferred_at" timestamptz,
  "needs_review" boolean NOT NULL DEFAULT false,
  "last_error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "seller_payouts_status_valid" CHECK ("status" in ('held', 'disputed', 'transferred', 'canceled')),
  CONSTRAINT "seller_payouts_amounts" CHECK ("amount_cents" >= 0 AND "fee_cents" >= 0 AND "amount_cents" + "fee_cents" = "gross_cents")
);
CREATE INDEX IF NOT EXISTS "seller_payouts_due_idx" ON "seller_payouts" ("release_after") WHERE "status" = 'held';
CREATE INDEX IF NOT EXISTS "seller_payouts_seller_idx" ON "seller_payouts" ("seller_id");
