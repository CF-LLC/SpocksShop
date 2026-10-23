import { shippoKey } from "./config";
import { createShippoClient, type ShippoClient } from "./shippo";

/** null when SHIPPO_API_KEY is unset. SHIPPO_API_BASE (tests/mock only) overrides https://api.goshippo.com. */
export function getShippo(env: Record<string, string | undefined> = process.env): ShippoClient | null {
  const key = shippoKey(env);
  if (!key) return null;
  return createShippoClient(key, fetch, env.SHIPPO_API_BASE?.trim() || undefined);
}
