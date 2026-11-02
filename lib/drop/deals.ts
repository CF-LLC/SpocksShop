import { unitPrice, type Garment } from "./config";

/**
 * Daily Drop multi-buy deals, applied automatically at checkout as reduced inline unit prices (named on the Stripe line).
 * Pairing order: each hoodie pairs with one tee (bundle), then remaining tees pair up (2 tees). Any design/size mix.
 * Margins (worst case = 2XL, Printful estimate-costs 2026-11-01, Stripe 2.9%+30c at 11.5% tax + 0.5% Stripe Tax):
 *   Tee + Hoodie $72 + $7.99 ship: cost $49.38 (M) / $53.68 (2XL) -> margin ~34% / ~29%
 *   2 Tees $52 + $4.99 ship: cost $33.74 (M) / $38.04 (2XL) -> margin ~37% / ~29%
 */
export const DEALS = {
  bundle: { label: "Tee + Hoodie bundle", tee: 2600, hoodie: 4600 },
  twoTees: { label: "2-tee deal", tee: 2600 },
} as const;
export const BUNDLE_PRICE = DEALS.bundle.tee + DEALS.bundle.hoodie;
export const TWO_TEE_PRICE = DEALS.twoTees.tee * 2;
type Line = { garment: Garment; size: string; qty: number };
export type DealUnit = { line: number; amount: number; deal: keyof typeof DEALS | null };

/** Per-unit prices for a cart (units of line i in order). Only S-XL style flat prices are discounted (2XL included). */
export function priceUnits(lines: Line[]): DealUnit[] {
  const units: DealUnit[] = [];
  lines.forEach((l, i) => { for (let k = 0; k < l.qty; k++) units.push({ line: i, amount: unitPrice(l.garment, l.size), deal: null }); });
  const tees = units.filter((u) => lines[u.line].garment === "tee");
  const hoodies = units.filter((u) => lines[u.line].garment === "hoodie");
  let t = 0;
  for (const h of hoodies) {
    if (t >= tees.length) break;
    Object.assign(h, { amount: DEALS.bundle.hoodie, deal: "bundle" });
    Object.assign(tees[t++], { amount: DEALS.bundle.tee, deal: "bundle" });
  }
  for (; t + 1 < tees.length; t += 2) for (const u of [tees[t], tees[t + 1]]) Object.assign(u, { amount: DEALS.twoTees.tee, deal: "twoTees" });
  return units;
}
export const dealCounts = (units: DealUnit[]) => ({ bundle: units.filter((u) => u.deal === "bundle").length / 2, twoTees: units.filter((u) => u.deal === "twoTees").length / 2 });
export const savings = (lines: Line[]) => lines.reduce((n, l) => n + unitPrice(l.garment, l.size) * l.qty, 0) - priceUnits(lines).reduce((n, u) => n + u.amount, 0);
