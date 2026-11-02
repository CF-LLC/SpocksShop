-- Daily Drop email signups (capture only, no emails are sent) + one 10% first-order code each. Additive only.
CREATE TABLE IF NOT EXISTS "drop_signups" (
  "id" bigserial PRIMARY KEY,
  "email" text NOT NULL UNIQUE,
  "code" text NOT NULL UNIQUE,
  "source" text,
  "consent_text" text NOT NULL,
  "ip_hash" text,
  "unsubscribed" boolean NOT NULL DEFAULT false,
  "unsubscribed_at" timestamptz,
  "redeemed_session_id" text,
  "redeemed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drop_signups_ip_created_idx" ON "drop_signups" ("ip_hash", "created_at");
