import Stripe from "stripe";

/** Pinned to the version shipped with stripe@23.0.0 (see node_modules/stripe/cjs/apiVersion.js). */
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;

type Env = Record<string, string | undefined>;

export type StripeSettings = {
  secretKey: string | null;
  webhookSecret: string | null;
  publishableKey: string | null;
  /**
   * Checkout is OFF unless STRIPE_CHECKOUT_ENABLED=true AND a secret key is set.
   * Adding keys alone never turns checkout on, so live keys can be installed and tested first.
   */
  checkoutEnabled: boolean;
  /** STRIPE_CHECKOUT_ENABLED is true but no secret key yet. */
  checkoutRequestedWithoutKey: boolean;
  webhookEnabled: boolean;
  mode: "test" | "live" | null;
};

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export function stripeSettings(env: Env = process.env): StripeSettings {
  const secretKey = clean(env.STRIPE_SECRET_KEY);
  const webhookSecret = clean(env.STRIPE_WEBHOOK_SECRET);
  const flag = clean(env.STRIPE_CHECKOUT_ENABLED)?.toLowerCase() === "true";
  return {
    secretKey,
    webhookSecret,
    publishableKey: clean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    checkoutEnabled: flag && Boolean(secretKey),
    checkoutRequestedWithoutKey: flag && !secretKey,
    webhookEnabled: Boolean(secretKey && webhookSecret),
    mode: secretKey ? (secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_") ? "live" : "test") : null,
  };
}

/**
 * Canonical public origin for Stripe redirect URLs. Uses APP_URL (https://spockshop.com in prod) so
 * success/cancel URLs never depend on request Host headers. Non-https APP_URL is only accepted outside production.
 */
export function siteOrigin(env: Env = process.env, fallback?: string): string | null {
  const raw = clean(env.APP_URL);
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === "https:" || env.NODE_ENV !== "production") return u.origin;
    } catch { /* fall through */ }
  }
  return env.NODE_ENV === "production" ? null : fallback ?? null;
}

let cached: { key: string; client: Stripe } | null = null;

/**
 * Server-side Stripe client, or null when STRIPE_SECRET_KEY is unset (the shop then shows
 * "Checkout coming soon"). STRIPE_API_BASE (e.g. http://localhost:12111) points at stripe-mock in tests only.
 */
export function getStripe(env: Env = process.env): Stripe | null {
  const { secretKey } = stripeSettings(env);
  if (!secretKey) return null;
  if (cached?.key === secretKey) return cached.client;
  const base = clean(env.STRIPE_API_BASE);
  const url = base ? new URL(base) : null;
  const client = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "SpockShop", url: "https://spockshop.com" },
    ...(url ? { host: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80), protocol: url.protocol.replace(":", "") as "http" | "https" } : {}),
  });
  cached = { key: secretKey, client };
  return client;
}
