/**
 * SERVER-ONLY. Admin "cost price" for the Daily Drop: verified admins pay exactly what the order costs us
 * (Printful + Stripe), no margin. Never import from a client component; never return these numbers from a public API.
 *
 * Source: Printful POST /orders/estimate-costs, store 18986800, STANDARD shipping to Little Rock AR 72201,
 * front print of a v4 design (cost is identical across all 10 v4 designs), read 2026-10-30.
 *   item = Printful item cost incl. front print, ship = Printful STANDARD shipping (1 item),
 *   pfTax = sales tax Printful charges us on that order.
 */
import type { CartLine } from "./core";
import { printfulVariant, type Garment } from "./config";

type Env = Record<string, string | undefined>;
type Cost = { variant: number; item: number; ship: number; pfTax: number }; // cents

export const PRINTFUL_COSTS: Record<string, Cost> = {
  "tee:S": { variant: 4016, item: 1192, ship: 535, pfTax: 129 },
  "tee:M": { variant: 4017, item: 1192, ship: 535, pfTax: 129 },
  "tee:L": { variant: 4018, item: 1192, ship: 535, pfTax: 129 },
  "tee:XL": { variant: 4019, item: 1192, ship: 535, pfTax: 129 },
  "tee:2XL": { variant: 4020, item: 1392, ship: 535, pfTax: 144 },
  "hoodie:S": { variant: 5594, item: 2263, ship: 919, pfTax: 239 },
  "hoodie:M": { variant: 5595, item: 2263, ship: 919, pfTax: 239 },
  "hoodie:L": { variant: 5596, item: 2263, ship: 919, pfTax: 239 },
  "hoodie:XL": { variant: 5597, item: 2263, ship: 919, pfTax: 239 },
  "hoodie:2XL": { variant: 5598, item: 2463, ship: 919, pfTax: 254 },
};

/** Stripe card fee 2.9% + 30c on the full charge (incl. tax), plus Stripe Tax 0.5% on the pre-tax amount. */
export const STRIPE_PCT = 0.029, STRIPE_FIXED = 30, STRIPE_TAX_PCT = 0.005;
/** Highest AR combined sales-tax rate we budget the fee for (tax collected on top is remitted, but Stripe's 2.9% applies to it). */
export const MAX_TAX_RATE = 0.115;
export const STRIPE_MIN_CHARGE_CENTS = 50;

export type AdminCostPrice = { unitAmounts: number[]; shipping: number; preTax: number; cost: number };

/**
 * Pre-tax charge P such that P - 2.9%*P*(1+r) - 30c - 0.5%*P >= cost, at r = MAX_TAX_RATE (lower rates leave a few cents spare).
 * Returns null if any line's cost is unknown or its variant doesn't match the live mapping -> caller uses public prices.
 * Multi-item carts conservatively pay full single-item shipping per unit.
 */
export function adminCostPrice(lines: CartLine[], env: Env = process.env): AdminCostPrice | null {
  const costs: Cost[] = [];
  for (const l of lines) {
    const c = PRINTFUL_COSTS[`${l.garment}:${l.size}`];
    if (!c || printfulVariant(l.garment as Garment, l.size, env) !== c.variant) return null;
    costs.push(c);
  }
  const denom = 1 - STRIPE_PCT * (1 + MAX_TAX_RATE) - STRIPE_TAX_PCT;
  const shipCost = lines.reduce((n, l, i) => n + costs[i].ship * l.qty, 0);
  const goodsCost = lines.reduce((n, l, i) => n + (costs[i].item + costs[i].pfTax) * l.qty, 0);
  const cost = shipCost + goodsCost;
  const preTax = Math.max(STRIPE_MIN_CHARGE_CENTS, Math.ceil((cost + STRIPE_FIXED) / denom));
  const shipping = shipCost;
  // Item units carry the rest; round up per unit so the sum never drops below preTax.
  const goods = preTax - shipping;
  const unitAmounts = lines.map((l, i) => Math.ceil((goods * ((costs[i].item + costs[i].pfTax) * l.qty) / goodsCost) / l.qty));
  const actual = unitAmounts.reduce((n, u, i) => n + u * lines[i].qty, 0) + shipping;
  return { unitAmounts, shipping, preTax: actual, cost };
}
