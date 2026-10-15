-- Blog posts for blog.spockshop.com (AI drafts, admin-approved). Additive only.
CREATE TABLE IF NOT EXISTS "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"target_keyword" text DEFAULT '' NOT NULL,
	"topic_key" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'buying_guide' NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"affiliate_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"ai_model" text,
	"published_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "blog_posts_status_valid" CHECK ("blog_posts"."status" in ('draft', 'published', 'rejected'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_posts_published_idx" ON "blog_posts" ("published_at") WHERE "status" = 'published';
