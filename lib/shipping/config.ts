/**
 * USPS labels via Shippo. Everything is env-driven; nothing here is hardcoded (no address, no key).
 *   SHIPPO_API_KEY                     server-only. Test key (shippo_test_...) buys free test labels.
 *   SHIP_FROM_NAME, SHIP_FROM_STREET1, SHIP_FROM_STREET2 (optional), SHIP_FROM_CITY,
 *   SHIP_FROM_STATE, SHIP_FROM_ZIP, SHIP_FROM_PHONE (optional), SHIP_FROM_EMAIL (optional)
 *                                      return address printed on labels; label purchase is blocked until set.
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

export const SHIP_FROM_REQUIRED = ["SHIP_FROM_NAME", "SHIP_FROM_STREET1", "SHIP_FROM_CITY", "SHIP_FROM_STATE", "SHIP_FROM_ZIP"] as const;

export function shipFrom(env: Env = process.env): { ok: true; address: ShipAddress } | { ok: false; missing: string[] } {
  const missing = SHIP_FROM_REQUIRED.filter((k) => !val(env[k]));
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    address: {
      name: val(env.SHIP_FROM_NAME),
      street1: val(env.SHIP_FROM_STREET1),
      ...(val(env.SHIP_FROM_STREET2) ? { street2: val(env.SHIP_FROM_STREET2) } : {}),
      city: val(env.SHIP_FROM_CITY),
      state: val(env.SHIP_FROM_STATE),
      zip: val(env.SHIP_FROM_ZIP),
      country: "US",
      ...(val(env.SHIP_FROM_PHONE) ? { phone: val(env.SHIP_FROM_PHONE) } : {}),
      ...(val(env.SHIP_FROM_EMAIL) ? { email: val(env.SHIP_FROM_EMAIL) } : {}),
    },
  };
}

export function trackingEmailEnabled(env: Env = process.env): boolean {
  return on(env.SHIPPING_TRACKING_EMAIL_ENABLED);
}

/** Orders a label can be bought for. */
export const SHIPPABLE_STATUSES = ["paid"] as const;
