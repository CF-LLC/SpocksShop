# Admin

All pages are under `/admin` (staff session required; `/api/admin/*` also checks the session).

- **Closet** (`/admin/closet`): create, edit and delete Spock's Closet items (`products.source = 'closet'`). Edit page uploads photos (JPEG/PNG/WebP, 5 MB each) to the media volume, reorders them (↑/↓) and deletes them. Uploaded photos replace the catalog images in the shop. Deleting an item removes its inventory row and photo files.
- **Amazon Picks** (`/admin/affiliate`): CRUD for `affiliate_items`. Each needs an Amazon URL or an ASIN; links are always rebuilt with `tag=mrspock-20`. Lower `sort_order` shows first.
- **Approval queue** (`/admin/community`): pending community listings with photos. *Approve & publish* creates a `community` product (quantity 1, listed) owned by the seller and moves the photos onto it; the seller must be active. *Reject* requires a note, which the seller sees on their dashboard.
- **Sellers** (`/admin/sellers`): activate or suspend sellers. Suspended sellers' listings disappear from the Community Market and their product pages 404.

The storefront `/shop` and `/shop/[slug]` read the Closet from the database (falling back to the static catalog in `lib/data.ts` if the DB is unreachable). Home, Hunt, cart and wishlist still use the static catalog.

## Bulk import of Amazon picks
- Admin: **/admin/affiliate/import** — paste or upload JSON, *Preview* first, then *Import*.
- CLI (same code path): `docker compose -p spockshop exec -T app npx tsx scripts/import-affiliate.mts - < picks.json`
  (`--dry-run` to preview). Locally: `DATABASE_URL=... npx tsx scripts/import-affiliate.mts data/amazon-picks-batch1.json`.
- Format: array (or `{ "items": [...] }`) of `{ title, asin | link, price?, image_url?, active?, sort_order? }`;
  other fields (blurb, rating, ...) are ignored. Validation uses zod; the whole batch is rejected if any pick is invalid.
- Upserts by ASIN, else by link. Never deletes. Links are rewritten to `https://www.amazon.com/dp/<ASIN>?tag=mrspock-20`
  (non-Amazon links are rejected), and `price_note` becomes "About $X, price may vary on Amazon".

## Removing the original sample products

The first seed inserted 14 placeholder products (SKUs `SRS-…`). The seed no longer does this, but existing databases still have them.

```bash
# Dry run (default): lists exactly what would be removed. Changes nothing.
docker compose exec app npx tsx scripts/remove-sample-products.mts
# After review and approval:
docker compose exec app npx tsx scripts/remove-sample-products.mts --apply
```

Rows are matched on seed SKU **and** slug (closet only). Any product referenced by an order line is refused.
