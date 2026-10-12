# Database

PostgreSQL 16. ORM: Drizzle. Driver: `postgres.js`.

## Tables

- `users` — admin/staff credentials
- `customers` — website buyers (unused until checkout)
- `addresses` — shipping/billing/pickup
- `categories`
- `products` — unique-find flag default true; `purchase_cost_cents` is admin-only; `source` (`closet` | `affiliate` | `community`, default `closet`) and optional `seller_id`
- `inventory` — `on_hand`, `reserved`, `sold`; check constraint prevents reserved > on hand
- `shipping_rates` — editable weight table
- `tax_rates` — configurable jurisdictions, dates, source, verified flag
- `orders` — includes `sales_channel`; website vs marketplace are distinct
- `order_items` — price/title snapshots
- `payments` — Stripe or BTCPay rows; no fake success
- `refunds`
- `admin_notes`
- `sellers` — community seller accounts: optional `user_id`, `email`, `display_name`, `status` (`pending` | `active` | `suspended`), nullable `payout_method` (placeholder only, no Stripe Connect)
- `community_listings` — seller submissions: `status` (`draft` | `pending` | `approved` | `rejected`), `moderation_note`, `reviewed_by` (admin user), `reviewed_at`; `product_id` is set once an approved listing is published
- `affiliate_items` — `title`, `image_url`, `amazon_url` and/or `asin` (at least one required), `price_note`, `active`, `sort_order`
- `photos` — files on the media volume (`/var/spocks/media`); `storage_path` is relative to it; belongs to a product or a community listing
- `error_log` — `level`, `source`, `message`, `context` JSON, `occurred_at`; backs a future health page

## Shop sections

The shop has three sections, selected by `products.source`:

- **closet** — Cooper's own items. Migration `0001_marketplace` backfills every existing product as `closet`.
- **community** — approved `community_listings` published as products with `seller_id` set.
- **affiliate** — `affiliate_items`, linked out to Amazon.

## Affiliate links

Always build outbound links with `lib/commerce/affiliate.ts` (`affiliateUrlFor`, `withAffiliateTag`, `buildAffiliateUrlFromAsin`). They force `tag=mrspock-20` (replacing any other tag), force https and reject non-Amazon hosts.

## Oversell protection

`reserveInventory` and `commitInventorySale` use `SELECT … FOR UPDATE` inside a transaction.

## Migrations and seed

See `docs/self-hosting.md`.
