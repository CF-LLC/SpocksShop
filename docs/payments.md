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
