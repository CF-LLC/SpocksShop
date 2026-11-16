/** Holiday Closet gift page and the "buy direct" note. Prices are never changed here. */

export const HOLIDAY_PATH = "/holiday";

/** Exclusive upper bounds, in cents: under $10 and under $20. */
export const UNDER_10_CENTS = 1000;
export const UNDER_20_CENTS = 2000;

/**
 * Tasteful note for shoppers coming from Depop or other marketplaces.
 * No specific dollar saving is claimed; there is no direct-price discount in the catalog.
 */
export const BUY_DIRECT_COPY =
  "Found us on Depop? Buy direct on SpockShop to skip marketplace fees. It's often cheaper than marketplaces, and items in the same order ship together.";

export type Priced = { priceCents: number };

/** Split live Closet items into under-$10 and $10–under-$20 groups, cheapest first. */
export function holidayGiftSections<T extends Priced>(products: T[]): { under10: T[]; from10to20: T[]; total: number } {
  const under10 = products.filter((p) => p.priceCents >= 0 && p.priceCents < UNDER_10_CENTS).sort((a, b) => a.priceCents - b.priceCents);
  const from10to20 = products.filter((p) => p.priceCents >= UNDER_10_CENTS && p.priceCents < UNDER_20_CENTS).sort((a, b) => a.priceCents - b.priceCents);
  return { under10, from10to20, total: under10.length + from10to20.length };
}
