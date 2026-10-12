CREATE TABLE "affiliate_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"amazon_url" text,
	"asin" text,
	"price_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_items_url_or_asin" CHECK ("affiliate_items"."amazon_url" is not null or "affiliate_items"."asin" is not null)
);
--> statement-breakpoint
CREATE TABLE "community_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"product_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"condition" text,
	"price_cents" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"moderation_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_listings_product_id_unique" UNIQUE("product_id"),
	CONSTRAINT "community_listings_status_valid" CHECK ("community_listings"."status" in ('draft', 'pending', 'approved', 'rejected')),
	CONSTRAINT "community_listings_price_non_negative" CHECK ("community_listings"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"community_listing_id" uuid,
	"storage_path" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_has_owner" CHECK ("photos"."product_id" is not null or "photos"."community_listing_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payout_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "sellers_email_unique" UNIQUE("email"),
	CONSTRAINT "sellers_status_valid" CHECK ("sellers"."status" in ('pending', 'active', 'suspended'))
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source" text DEFAULT 'closet' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seller_id" uuid;--> statement-breakpoint
ALTER TABLE "community_listings" ADD CONSTRAINT "community_listings_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_listings" ADD CONSTRAINT "community_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_listings" ADD CONSTRAINT "community_listings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_community_listing_id_community_listings_id_fk" FOREIGN KEY ("community_listing_id") REFERENCES "public"."community_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_source_valid" CHECK ("products"."source" in ('closet', 'affiliate', 'community'));