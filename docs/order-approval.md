# Order approval (authorize now, charge on accept)

Closet Picks are also listed on Depop, so an item can sell elsewhere between listing and checkout.
Items with **Requires my approval** (default on for Closet Picks; checkbox on the item edit page) go through
Stripe Checkout with dynamic payment methods and per-method `payment_method_options[<type>][capture_method]=manual`: holdable methods (card incl. Apple/Google Pay, Link, Klarna, Affirm, Afterpay, Cash App Pay, Amazon Pay) are authorized, not charged; methods that can't be held (crypto/stablecoins, ACH) are charged immediately and refunded in full on Decline. See `docs/payments.md`.

Flow

1. Checkout reserves the item (row lock on `inventory`, `quantity_reserved <= quantity_on_hand` check) and creates a
   `pending` order with `requires_approval=true`. The session is card-only, manual capture, tagged `requires_approval=true`.
2. `checkout.session.completed` (signature-verified webhook) moves the order to `awaiting_approval`, stores the
   PaymentIntent, sets the product to `pending_approval` (hidden from the shop, not purchasable), starts a 6-day hold,
   emails Cooper and the buyer ("order received, confirming availability"). Re-deliveries are no-ops.
   If the 90-minute stale-pending sweep already released the hold and someone else took the item, the authorization
   is voided right away and the buyer is told; nothing is held twice.
3. `/admin/orders` → **Accept & charge** captures the PaymentIntent, marks the item sold and emails the buyer.
   **Decline** voids it, relists the item and emails the buyer. Both claim the order atomically
   (`capturing` / `declining`), use Stripe idempotency keys, and are safe to retry or double-click.
4. The hold sweep (every `ORDER_APPROVAL_SWEEP_MINUTES`, default 15, inside the Node server; or
   `npm run holds:sweep` from cron) emails Cooper at 24h and day 5 and auto-cancels at 6 days (Stripe's card
   authorization window is ~7 days).

Checkout itself still only turns on with `STRIPE_CHECKOUT_ENABLED=true`; Stripe Tax stays off unless `STRIPE_TAX_ENABLED=true`.
Accept/Decline work whenever `STRIPE_SECRET_KEY` is set, so open holds can be resolved even if checkout is switched off.

Email: `MAIL_PROVIDER=log` (default) only logs subject + masked recipient. `MAIL_PROVIDER=resend` with
`RESEND_API_KEY` and `MAIL_FROM` sends for real. Alerts go to `ORDER_NOTIFY_EMAIL` (fallback `ADMIN_EMAIL`).
