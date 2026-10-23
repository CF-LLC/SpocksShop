/**
 * USPS labels via Shippo. Everything is env-driven; nothing here is hardcoded (no address, no key).
 *   SHIPPO_API_KEY                     server-only. Test key (shippo_test_...) buys free test labels.
 *   Return addresses are per account (admin Settings / seller dashboard), stored in ship_from_addresses.
 *   SHIPPING_TRACKING_EMAIL_ENABLED    default off: buyer tracking email is prepared but not sent.
 */
type Env = Record<string, string | undefined>;

const on = (v: string | undefined) => ["1", "true", "yes", "on"].includes((v ?? "").trim().toLowerCase());
const val = (v: string | undefined) => (v ?? "").trim();

export type ShipAddress = { name: string; street1: string; street2?: string; city: string; state: string; zip: string; country: "US"; phone?: string; email?: string };

export function shippoKey(env: Env = process.env): string | null {
  return val(env.SHIPPO_API_KEY) || null;
}

export function shippoMode(env: Env = process.env): "not_configured" | "test" | "live" {
  const k = shippoKey(env);
  if (!k) return "not_configured";
  return k.startsWith("shippo_test_") ? "test" : "live";
}

export function trackingEmailEnabled(env: Env = process.env): boolean {
  return on(env.SHIPPING_TRACKING_EMAIL_ENABLED);
}

/** Orders a label can be bought for. */
export const SHIPPABLE_STATUSES = ["paid"] as const;
