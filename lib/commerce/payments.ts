import { stripeSettings } from "@/lib/stripe";

export type PaymentProviderName = "stripe" | "btcpay";

/** What admin sees on /admin/payments. Never includes key values. */
export function paymentSettingsStatus(env: Record<string, string | undefined> = process.env) {
  const s = stripeSettings(env);
  return {
    stripeConfigured: Boolean(s.secretKey),
    stripeMode: s.mode,
    webhookConfigured: Boolean(s.webhookSecret),
    publishableKeyConfigured: Boolean(s.publishableKey),
    btcpayConfigured: Boolean(env.BTCPAY_URL && env.BTCPAY_API_KEY && env.BTCPAY_STORE_ID),
    checkoutEnabled: s.checkoutEnabled,
    note: s.checkoutEnabled
      ? s.webhookSecret
        ? "Stripe Checkout is live for Spock's Closet. Orders turn paid only when the signed webhook arrives."
        : "STRIPE_WEBHOOK_SECRET is missing: shoppers can pay, but orders stay pending and stock stays reserved until the webhook is configured."
      : s.checkoutRequestedWithoutKey
        ? "STRIPE_CHECKOUT_ENABLED is true but STRIPE_SECRET_KEY is missing, so the shop still shows 'Checkout coming soon'."
        : s.secretKey
          ? `Stripe keys are installed (${s.mode} mode) but checkout is OFF. Set STRIPE_CHECKOUT_ENABLED=true and restart to open it.`
          : "Stripe keys are not set, so the shop shows 'Checkout coming soon'.",
  };
}
