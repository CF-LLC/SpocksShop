# Community seller marketplace

Everything is behind `COMMUNITY_SELLERS_ENABLED` (default off). With the flag off, all seller pages/APIs,
`/api/stripe/connect-webhook` and `/api/shippo/webhook` return 404, seller items can't be checked out and the
payout sweeper never starts. Shop-owned items behave exactly as before (no fee, no transfer_group).

## Money flow: separate charges and transfers
1. Buyer pays the **platform** through the normal Checkout Session (Stripe Tax as today). Seller orders add
   `payment_intent_data.transfer_group = order_<orderId>`.
2. `checkout.session.completed` → order paid → a `seller_payouts` row is recorded **held**:
   gross = seller item subtotal, fee = `SELLER_FEE_BPS` (5%), amount = gross − fee. Shipping and tax stay with the platform.
3. Delivery: Shippo `track_updated` webhook (re-verified with `GET /tracks`), the sweeper polling tracking, or the
   admin "Mark delivered" button. Starts `release_after = delivered + SELLER_PAYOUT_HOLD_DAYS`.
4. Sweeper (every `SELLER_PAYOUT_SWEEP_MINUTES`): re-reads the charge; disputed → `disputed` (no transfer);
   fully refunded → `canceled`; partial refund → seller amount reduced by the refunded amount; otherwise
   `POST /v1/transfers` with `destination`, `transfer_group`, `source_transaction=<charge>` and idempotency key
   `seller-payout-<id>`. Suspended / not-ready sellers wait.
5. Refund or dispute **after** the transfer → payout flagged "needs review" in /admin/sellers/payouts. Transfer
   reversals are a manual admin decision (never automatic).
6. Not delivered `SELLER_PAYOUT_REVIEW_DAYS` after shipping → flagged; never auto-paid.

The fee is taken by transferring less, **not** with `application_fee_amount`: that parameter only applies to
destination/direct charges. Stripe processing fees on seller sales are paid by the platform out of the 5%.

## Onboarding (Accounts v2)
Accounts are created with `dashboard: "express"`, `identity.country: "us"`,
`defaults.responsibilities = { fees_collector: "application", losses_collector: "application" }` and the
**recipient** configuration requesting `stripe_balance.stripe_transfers`. Sellers onboard on Stripe-hosted
account links (`/api/sell/connect/onboard` = refresh URL, `/api/sell/connect/return` = return URL). Readiness =
`configuration.recipient.capabilities.stripe_balance.stripe_transfers.status === "active"`, synced from
`account.updated` (or v2 `v2.core.account*` thin events) by re-fetching the account. A seller can list and sell
only when admin-approved **and** ready. Carts are single-seller (or shop-only).
