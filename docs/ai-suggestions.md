# Photo-first listing + AI suggestions

`/admin/closet/new` starts with photos (camera or library, up to 12, reorder with ↑/↓, first = cover,
on-device background removal). Step 2 is details; with an AI key set, **Suggest details from photos**
sends up to 4 photos, downscaled in the browser to 1024px JPEG, to `POST /api/admin/ai/suggest`.
Each suggested field can be edited and accepted on its own, or use **Use all** / **Skip**. Nothing is saved until **Save item**.
`?classic=1` keeps the old form.

## Env (server-only, never `NEXT_PUBLIC_`)
| Var | Default | |
|---|---|---|
| `AI_PROVIDER` | `anthropic` | `anthropic` or `gemini` (`mock` works in dev only) |
| `AI_MODEL` | `claude-haiku-5-5` / `gemini-3.1-flash-lite` | |
| `AI_API_KEY` | unset | unset means the AI button is hidden and the flow still works |
| `AI_DAILY_LIMIT` / `AI_PER_MINUTE_LIMIT` | 50 / 6 | per user |
| `AI_PRICE_INPUT_PER_M` / `AI_PRICE_OUTPUT_PER_M` | list price | used for cost estimates |
| `AI_SELLER_BILLING_ENABLED` | `false` | while off, sellers can't use AI |
| `AI_CREDIT_PACK_SIZE` | 25 | |
| `STRIPE_PRICE_AI_CREDIT_PACK` / `STRIPE_PRICE_AI_PLAN_MONTHLY` | unset | create the prices in the Stripe Dashboard first |

`npm run check:client-secrets` (after build) fails if a secret name or value shows up in `.next/static`.

## Limits and validation
4 images max, 1.5 MB each and 5 MB in total. Magic bytes are checked (JPEG/PNG/WebP). The output must match a strict zod schema,
and conditions are mapped to the shop's values. Logs never include image data, prompts or keys.

## Entitlement
Admin and staff are free. Sellers (`POST /api/sell/ai/suggest`) need `AI_SELLER_BILLING_ENABLED=true` plus an active plan or credits > 0.
A successful seller suggestion paid with credits writes a `-1` ledger row. Errors and invalid output are not charged.
Tables (migration 0004, additive): `ai_usage_events`, `ai_credit_ledger` (balance = sum(delta); unique `reference` = Checkout Session id),
`seller_ai_plans`. Usage is shown at `/admin/ai`.

## Seller billing (stub)
`POST /api/sell/ai/checkout` with `kind=credits` creates a Checkout session (mode=payment); `kind=plan` creates one with mode=subscription.
Either returns 503 until the flag and price ids are set. When the flag is on, the webhook handles `checkout.session.completed`
(credit grant, idempotent), `customer.subscription.updated` and `customer.subscription.deleted` for sessions tagged `metadata.kind=ai_*`.
Add the two subscription events to the Stripe endpoint only when you enable seller billing.
