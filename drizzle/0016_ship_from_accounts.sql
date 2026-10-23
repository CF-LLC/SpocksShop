-- Per-account return addresses for labels (additive). One row per admin user OR per seller.
CREATE TABLE IF NOT EXISTS "ship_from_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "seller_id" uuid UNIQUE REFERENCES "sellers"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "street1" text NOT NULL,
  "street2" text,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "zip" text NOT NULL,
  "phone" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ship_from_one_owner" CHECK (("user_id" IS NULL) <> ("seller_id" IS NULL))
);
