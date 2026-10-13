import { paymentSettingsStatus } from "@/lib/commerce/payments";

const yes = (v: boolean) => (v ? "yes" : "no");

export default function AdminPaymentsPage() {
  const s = paymentSettingsStatus();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Payment Settings</h1>
      <p className="text-sm text-slate-700">{s.note}</p>
      <ul className="space-y-2 text-sm">
        <li>Stripe secret key (STRIPE_SECRET_KEY): {yes(s.stripeConfigured)}{s.stripeMode ? ` (${s.stripeMode} mode)` : ""}</li>
        <li>Checkout switch (STRIPE_CHECKOUT_ENABLED=true): {yes(s.checkoutEnabled)}</li>
        <li>Webhook signing secret (STRIPE_WEBHOOK_SECRET): {yes(s.webhookConfigured)}</li>
        <li>Publishable key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, optional): {yes(s.publishableKeyConfigured)}</li>
        <li>Webhook endpoint: <code>https://spockshop.com/api/stripe/webhook</code> (events: checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed)</li>
        <li>Tax collection: off (tax row unverified with Arkansas DFA)</li>
        <li>Seller-listed Closet Picks checkout: only when COMMUNITY_SELLERS_ENABLED is on; seller payouts are not built yet</li>
        <li>BTCPay configured: {yes(s.btcpayConfigured)} (not wired to checkout)</li>
      </ul>
    </section>
  );
}
