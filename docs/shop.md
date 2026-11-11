# Shop sections

`/shop` has three sections. Their names live in `lib/shop/sections.ts` (`SHOP_SECTIONS`, `COMMUNITY_MARKET_NAME`).

| Section | Source | Data |
| --- | --- | --- |
| Amazon Picks | `affiliate_items` (active, by `sort_order`) | Links via `AffiliateLink` → `affiliateUrlFor` (always `tag=mrspock-20`), `rel="sponsored nofollow noopener"`, `target="_blank"` |
| Spock's Closet | Cooper's own items | existing catalog |
| Community Market | `community_listings` with `status = 'approved'` from `active` sellers | photos from the media volume via `/media/...` |

The Amazon Associates disclosure ("As an Amazon Associate I earn from qualifying purchases.") is shown on the Amazon Picks section and in the site footer.

## Community sellers (feature flag)

`COMMUNITY_SELLERS_ENABLED` (default off). When off, `/sell/*` pages and `/api/sell/*` routes return 404 and the Community Market shows a "coming soon" note.

When on:

- `/sell` is the public landing page (redirects signed-in sellers to the dashboard). `/sell/signup` creates a `users` row (role `seller`) and a `sellers` row with status `pending`.
- `/sell/login`, `/sell/dashboard`. Seller sessions use their own cookie and JWT audience, so they can never open `/admin`.
- A seller can submit listings only when the account is admin-approved, Stripe payouts are ready, and a return address is saved. Listings need a weight (lb) so checkout can quote shipping, plus 1–8 photos (JPEG/PNG/WebP, 5 MB each). Listings are created as `pending` and wait for admin review. Approved listings copy that weight onto the published product.
- If Stripe Connect platform activation is incomplete, the dashboard explains that payouts aren't open yet and does not send the seller into a failing Stripe onboarding click.

Photos are written to `MEDIA_DIR` (default `/var/spocks/media`, the `spocks_media` volume).
