-- Seller listings need a weight so checkout can quote shipping (same weight table as Closet Picks).
ALTER TABLE "community_listings" ADD COLUMN IF NOT EXISTS "weight_lb" numeric(8, 2);
