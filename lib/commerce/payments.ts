import { stripeSettings } from "@/lib/stripe";

export type PaymentProviderName = "stripe" | "btcpay";

/** What admin sees on /admin/payments. Never includes key values. */
export function paymentSettingsStatus(env: Record<string, string | undefined> = process.env) {
  const s = stripeSettings(env);
  return {
    stripeConfigured: s.checkoutEnabled,
    stripeMode: s.mode,
    webhookConfigured: Boolean(s.webhookSecret),
    publishableKeyConfigured: Boolean(s.publishableKey),
    btcpayConfigured: Boolean(env.BTCPAY_URL && env.BTCPAY_API_KEY && env.BTCPAY_STORE_ID),
    checkoutEnabled: s.checkoutEnabled,
    note: s.checkoutEnabled
      ? s.webhookSecret
        ? "Stripe Checkout is live for Spock's Closet. Orders turn paid only when the signed webhook arrives."
        : "STRIPE_WEBHOOK_SECRET is missing: shoppers can pay, but orders stay pending and stock stays reserved until the webhook is configured."
      : "Stripe keys are not set, so the shop shows 'Checkout coming soon'.",
  };
}
