-- Daily Drop print-on-demand orders (additive only).
CREATE TABLE IF NOT EXISTS "drop_orders" (
  "id" bigserial PRIMARY KEY,
  "stripe_session_id" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'received',
  "printful_order_id" text,
  "email" text,
  "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "amount_total" integer,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
