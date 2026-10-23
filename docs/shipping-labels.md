# USPS shipping labels (Shippo)

- Checkout collects a US shipping address (`shipping_address_collection: US`); the webhook saves it on the order.
  The shipping line charged at checkout is unchanged (existing weight table in admin).
- Admin → Orders → open an order → **USPS label** panel:
  1. Enter box size + weight → **Get USPS rates** (never buys).
  2. Pick a rate, tick confirm → **Buy USPS label**. Only this click buys. One active label per order
     (DB partial unique index), so double clicks can't buy twice; a failed purchase can be retried.
  3. Label PDF (4x6) opens/prints from the panel. Order becomes `shipped` with USPS tracking number + link.
- Buyer tracking email is prepared (lib/shipping/service.ts `trackingEmail`) but only sent when
  `SHIPPING_TRACKING_EMAIL_ENABLED=true`.

Env: `SHIPPO_API_KEY` (test key `shippo_test_...` buys free test labels), `SHIP_FROM_NAME`, `SHIP_FROM_STREET1`,
`SHIP_FROM_STREET2` (opt), `SHIP_FROM_CITY`, `SHIP_FROM_STATE`, `SHIP_FROM_ZIP`, `SHIP_FROM_PHONE` (opt),
`SHIP_FROM_EMAIL` (opt), `SHIPPING_TRACKING_EMAIL_ENABLED`. `SHIPPO_API_BASE` is for tests/mocks only.
Without a key the panel shows "Shippo key not configured" and buttons are disabled.
