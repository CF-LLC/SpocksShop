# Payments (Stripe Checkout)

Spock's Closet items are bought through **Stripe Checkout** (hosted page). Amazon Picks link to Amazon and are never sold here.
Community Market items can only be checked out when `COMMUNITY_SELLERS_ENABLED` is on (seller payouts are not built yet, so keep it off).

## Env (`.env` on the server)

| Var | Needed | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | yes | `sk_live_…` (or a restricted `rk_live_…`) in production. Without it every buy button shows **Checkout coming soon**. |
| `STRIPE_CHECKOUT_ENABLED` | yes | Must be exactly `true` to open checkout. Keys alone never turn checkout on. |
| `APP_URL` | yes | `https://spockshop.com`. Success/cancel URLs are built from it; checkout refuses to start in production if it is not https. |
| `STRIPE_WEBHOOK_SECRET` | yes | `whsec_…` from the webhook endpoint (or `stripe listen`). Without it orders stay pending and stock stays held until the 90-minute stale release. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no | Not used by hosted Checkout; shown as configured in admin only. Read at runtime (no rebuild needed, just recreate the container). |

The webhook ignores events whose `livemode` doesn't match the key's mode, so a test endpoint can't mark live orders paid. `.dockerignore` keeps `.env` and other secrets out of the image build.

The API version is pinned in `lib/stripe.ts` (`2026-09-30.endive`, the version stripe@23.0.0 ships with).

## Stripe Tax (optional, off by default)

`STRIPE_TAX_ENABLED=true` turns on `automatic_tax`. Prices and shipping are sent as tax-exclusive, with tax codes
`STRIPE_PRODUCT_TAX_CODE` (default `txcd_99999999`, general tangible goods) and `STRIPE_SHIPPING_TAX_CODE` (default `txcd_92010001`).
Stripe needs a customer location, so shipped orders use the shipping address and pickup orders require a billing address.
The webhook accepts `amount_total = order total + amount_tax` and records the tax on the order.
Before turning it on: activate Stripe Tax, set the origin address (Bentonville, AR) and add the Arkansas registration in the dashboard.

## Flow

1. `/checkout`: the shopper picks **local pickup** (free, Bentonville) or **ship** (US, rate by total weight from `shipping_rates`).
2. `POST /api/checkout` (same-origin only) takes product ids + quantities only. In one transaction it locks inventory rows, prices every line from the DB, creates a `pending` order + `order_items`, and increments `quantity_reserved`.
3. A Checkout Session is created with those DB prices, one fixed shipping option, `automatic_tax` off (the tax row is unverified), and `expires_at` = 30 minutes. If Stripe fails, the hold is released.
4. `POST /api/stripe/webhook` verifies the `Stripe-Signature` on the raw body, then:
   - `checkout.session.completed` (paid) / `checkout.session.async_payment_succeeded`: order → `paid`, reserved → sold, on-hand decremented, product → `sold` at 0. Re-deliveries are no-ops (row lock + status check).
   - `checkout.session.completed` (unpaid, delayed method): order → `processing`, stock stays held.
   - `checkout.session.expired` / `checkout.session.async_payment_failed`: hold released once, order → `canceled`.
   - A paid amount that differs from the order total marks it `paid_review`.
5. `/checkout/cancel` expires the session right away so the item frees up; `/checkout/success` shows the order number.
6. Safety net: pending orders older than 90 minutes are released on the next checkout.

## Going live

1. Put `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (from the **live** endpoint below) and `APP_URL=https://spockshop.com` in `.env`, keep `STRIPE_CHECKOUT_ENABLED=false`, then `docker compose -p spockshop up -d app`.
2. Check `/admin/payments`: secret key yes (live mode), webhook secret yes, checkout switch no. Use the dashboard's "Send test webhook" to confirm a 200.
3. Set `STRIPE_CHECKOUT_ENABLED=true` and `up -d app` again to open checkout.

## Setup (test mode)

1. Stripe Dashboard → Developers → API keys: copy the **test** secret key into `STRIPE_SECRET_KEY`.
2. Webhook, either:
   - Dashboard → Developers → Webhooks → Add endpoint `https://spockshop.com/api/stripe/webhook`, events
     `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`; copy the signing secret into `STRIPE_WEBHOOK_SECRET`; or
   - Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the `whsec_…` it prints (local testing only).
3. Set `STRIPE_CHECKOUT_ENABLED=true`, `docker compose up -d app` to pick up the env, then buy a test item with card `4242 4242 4242 4242`.

## Tests

- `npm test`: unit tests with mocked Stripe (session params, webhook routing, real signature verification).
- Integration (real Postgres + [stripe-mock](https://github.com/stripe/stripe-mock)):
  `INTEGRATION_DATABASE_URL=postgres://…/throwaway STRIPE_API_BASE=http://localhost:12111 npx vitest run tests/integration`

## More payment methods on approval orders

Closet items need Cooper's OK (`requiresApproval`). Their Checkout Sessions no longer force `allowed_payment_method_types: ["card"]`;
they use **dynamic payment methods** (whatever the Dashboard payment method configuration enables) and hold only the methods that
support separate authorization and capture, via `payment_method_options[<type>][capture_method]=manual`
(`HELD_PAYMENT_METHODS` in `lib/checkout/core.ts`). There is no session-wide `payment_intent_data.capture_method` any more, because
that would hide every method that can't be held.
Docs: [Place a hold on a payment method](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) (per-method capture),
[Checkout Session `payment_method_options`](https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-payment_method_options).

| Method | At checkout | Accept | Decline / 6-day expiry |
| --- | --- | --- | --- |
| Card, Apple Pay, Google Pay (card wallets), Link, Klarna, Affirm, Afterpay, Cash App Pay, Amazon Pay | held (`requires_capture`) | capture | cancel the PaymentIntent (hold released) |
| Stablecoins/crypto | charged now (`succeeded`) | nothing to capture; order → paid | **full refund** (recorded in `refunds`, payment → `refunded`) |
| ACH (delayed settlement) | `processing`, item held | waits until `checkout.session.async_payment_succeeded`, then just confirms | waits while processing, refunds once settled; `async_payment_failed` relists the item and closes the order |

The service asks Stripe for the PaymentIntent status before acting, so Accept/Decline are correct even if a webhook was missed.
Everything is idempotent: capture/cancel/refund use idempotency keys (`approval-{capture|cancel|refund}-<order id>`), a refund that
already exists on the PaymentIntent is reused, the refund row is inserted once, and the order status claim stops double clicks.
Tax (`automatic_tax`), shipping/billing address rules and closet-only gating are unchanged. No new env vars.

Holds: the app auto-cancels after 6 days, inside the shortest window (cards and Cash App Pay ~7 days; Afterpay 13; Klarna 28; Affirm 30).

## Stripe Dashboard clicks for Cooper

1. **Settings → Payments → Payment methods → Crypto / "Stablecoins & Crypto"**: click *Request access* (USDC etc., ~1.5% fee). Until approved it simply doesn't show at checkout.
2. Same page (the default payment method configuration): optionally turn on **Afterpay / Clearpay** and **ACH Direct Debit**. Keep the others that are on (Apple Pay, Link, Cash App Pay, Klarna, Affirm, Amazon Pay).
3. **Google Pay shows "unavailable"**: open Google Pay on that page and read the reason. Common causes: it's turned off in the configuration, the account needs a domain registered (Settings → Payment method domains → add `spockshop.com`; hosted Checkout normally doesn't need this), or Google Pay hasn't accepted the business yet. Also note Google Pay only appears in Chrome/Android with a saved card, so test from there.

No code or env change is needed after any of these: dynamic payment methods pick them up automatically.

## Bitcoin via BTCPay Server (plan only, nothing installed)

**Server first.** spock-server's disk is at 81% (~18 GB free). A pruned Bitcoin node needs ~10–15 GB with `prune` plus ~5 GB for NBXplorer/Postgres/docker images and grows with logs, so free space (old images, `docker system prune`, old backups) or add an external/second disk before starting. Initial sync takes 1–3 days and lots of CPU/bandwidth.

**Install (later, with approval):** BTCPay's docker deployment (`btcpayserver-docker`) with `BTCPAYGEN_CRYPTO1=btc`, `BTCPAYGEN_ADDITIONAL_FRAGMENTS=opt-save-storage-s` (pruned), no Lightning at first. Expose it at e.g. `pay.spockshop.com` through the Cloudflare Tunnel; protect the admin UI with Cloudflare Access but leave `/i/*` invoice pages and the API reachable. Wallet: hardware-wallet xpub (watch-only), so no private keys live on the server.

**Existing scaffolding:** `payments.payment_provider` (`stripe | btcpay`), `btcpayConfigured()` and the admin payments page status, and the `BTCPAY_*` env names (URL, store id, API key, webhook secret) are already in place.

**App work:**
- Invoice: on checkout with "Pay with Bitcoin", reserve stock as today, create a BTCPay invoice (Greenfield API `POST /api/v1/stores/{store}/invoices`, amount in USD, `orderId` metadata, 30-min expiry matching our reservation) and redirect to the invoice page.
- Webhook `/api/btcpay/webhook`: verify the `BTCPay-Sig` HMAC, handle `InvoiceSettled` (→ same approval flow as a captured payment: held for Cooper, Decline refunds), `InvoiceExpired`/`InvoiceInvalid` (release), `InvoiceProcessing` (keep holding, like ACH). Idempotent by invoice id.
- Tax: BTCPay doesn't calculate tax. Before creating the invoice, call **Stripe Tax Calculations API** (`POST /v1/tax/calculations` with the line items, tax codes and customer address) and add the tax to the invoice amount; after the invoice settles, create a **Tax Transaction** (`POST /v1/tax/transactions/create_from_calculation`) so it shows in Stripe Tax reports and filings; on refund, `POST /v1/tax/transactions/create_reversal`. Addresses must be collected on our own page since there's no Stripe Checkout.
- Refunds: BTCPay refunds are manual-ish (Greenfield `POST /invoices/{id}/refund` creates a pull payment the buyer claims with their address), at the current rate or the original amount; record in `refunds`.
- Accounting: record USD value at settlement (BTCPay stores the rate), export BTCPay's invoice report monthly for the books; BTC held is a capital asset, so selling it later is a separate taxable event.

**Effort:** ~2–4 dev days for the app (invoice, webhook, tax calc/transactions, refunds, admin UI, tests) plus server prep/sync time and Cooper's wallet setup. Fees: 0% processor fee, only on-chain network fees. Recommendation: do Stripe stablecoins first; revisit BTCPay after the disk is fixed and if buyers actually ask for BTC.
