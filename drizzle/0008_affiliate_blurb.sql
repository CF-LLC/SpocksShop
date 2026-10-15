-- Amazon picks: keep the curator blurb (shown on cards) and the full Amazon title
-- when `title` is a shortened display title. Additive, nullable columns only.
-- Numbered 0008 because the blog PR (#18) claims 0007_blog_posts.
ALTER TABLE "affiliate_items" ADD COLUMN IF NOT EXISTS "full_title" text;
--> statement-breakpoint
ALTER TABLE "affiliate_items" ADD COLUMN IF NOT EXISTS "blurb" text;
