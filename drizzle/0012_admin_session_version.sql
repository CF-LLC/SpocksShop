-- Server-side revocation for long-lived admin sessions ("log out everywhere").
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer NOT NULL DEFAULT 0;
