-- Daily Drop: flag admin test orders so sales reports can exclude them (additive only).
ALTER TABLE "drop_orders" ADD COLUMN IF NOT EXISTS "admin_test" boolean NOT NULL DEFAULT false;
