-- Data-only migration: Star Trek picks get their own "star-trek" Amazon category.
-- Idempotent, UPDATE-by-ASIN only (no deletes, no schema change). ASINs not in the
-- DB are simply no-ops. Runs once at deploy via scripts/migrate.mts.

-- Curator batch 1 (collectibles, apparel, books/media, gadgets)
UPDATE "affiliate_items" SET "category" = 'star-trek', "updated_at" = now()
WHERE "asin" IN (
  'B0D9NS9RT5','B0DSWGSBFT','B09WF2ZDX5','B0BHTX6JW7','B08G5GJQN2',
  'B07MZRZRTD','B07BRNFHYY','B016OMI3C4','B0B5RH3GTQ','B0G3Y3MB12',
  '067174559X','1858755409','B0777S47VQ','B01M4IE5NP','B092XKSD8G'
) AND "category" IS DISTINCT FROM 'star-trek';
--> statement-breakpoint
-- Home batch: the 10 Star Trek items (not the galaxy canvas or the two drawer organizers)
UPDATE "affiliate_items" SET "category" = 'star-trek', "updated_at" = now()
WHERE "asin" IN (
  'B088YNMC12','B079Z8M2HJ','B0BKB1BFCL','B0DVJ5SYY3','B00JF9IJ7I',
  '0762449896','1982186283','B08M5XTF28','B08PFJFSH2','B09CS79LLW'
) AND "category" IS DISTINCT FROM 'star-trek';
--> statement-breakpoint
-- Umite Chef utensil set belongs in Necessities
UPDATE "affiliate_items" SET "category" = 'necessities', "updated_at" = now()
WHERE "asin" = 'B08573DQ39' AND "category" IS DISTINCT FROM 'necessities';
