# Admin

All pages are under `/admin` (staff session required; `/api/admin/*` also checks the session).

- **Closet** (`/admin/closet`): create, edit and delete Spock's Closet items (`products.source = 'closet'`). Edit page uploads photos (JPEG/PNG/WebP, 5 MB each) to the media volume, reorders them (↑/↓) and deletes them. Uploaded photos replace the catalog images in the shop. Deleting an item removes its inventory row and photo files.
- **Amazon Picks** (`/admin/affiliate`): CRUD for `affiliate_items`. Each needs an Amazon URL or an ASIN; links are always rebuilt with `tag=mrspock-20`. Lower `sort_order` shows first.
- **Approval queue** (`/admin/community`): pending community listings with photos. *Approve & publish* creates a `community` product (quantity 1, listed) owned by the seller and moves the photos onto it; the seller must be active. *Reject* requires a note, which the seller sees on their dashboard.
- **Sellers** (`/admin/sellers`): activate or suspend sellers. Suspended sellers' listings disappear from the Community Market and their product pages 404.

The storefront `/shop` and `/shop/[slug]` read the Closet from the database (falling back to the static catalog in `lib/data.ts` if the DB is unreachable). Home, Hunt, cart and wishlist still use the static catalog.
