-- Blog draft API (POST /api/blog/drafts): tags, an https cover image and product links.
-- Additive, defaulted columns only; existing posts are untouched.
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "product_links" jsonb DEFAULT '[]'::jsonb NOT NULL;
