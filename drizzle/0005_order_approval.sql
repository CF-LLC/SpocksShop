-- Order approval (authorize now, capture when Cooper accepts). Additive only.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Closet Picks are also listed on Depop, so they default to needing approval.
UPDATE "products" SET "requires_approval" = true WHERE "source" = 'closet';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "authorized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "hold_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reminder_24h_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reminder_day5_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "decision_reason" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_awaiting_approval_idx" ON "orders" ("hold_expires_at") WHERE "status" IN ('awaiting_approval', 'capturing', 'declining');
