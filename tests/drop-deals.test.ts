import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { BUNDLE_PRICE, TWO_TEE_PRICE, priceUnits, savings } from "../lib/drop/deals";
import { buildPrintfulOrder, buildSessionParams, parseCart } from "../lib/drop/core";
import { STRIPE_PCT, STRIPE_FIXED, STRIPE_TAX_PCT, MAX_TAX_RATE } from "../lib/drop/admin-cost";

const env = { PRINTFUL_VARIANTS: JSON.stringify({ "tee:M": 4017, "tee:L": 4018, "tee:2XL": 4020, "hoodie:M": 5595, "hoodie:2XL": 5598 }) };
const margin = (rev: number, cost: number) => (rev - (rev * STRIPE_PCT * (1 + MAX_TAX_RATE) + STRIPE_FIXED + rev * STRIPE_TAX_PCT) - cost) / rev;

describe("drop deals", () => {
  it("prices: bundle $72, 2 tees $52 (matches /drop banner)", () => {
    expect(BUNDLE_PRICE).toBe(7200);
    expect(TWO_TEE_PRICE).toBe(5200);
  });
  it("worst-case (2XL, Printful estimate 2026-11-01) margins stay >= 28%", () => {
    expect(margin(BUNDLE_PRICE + 799, 5368)).toBeGreaterThan(0.28);
    expect(margin(TWO_TEE_PRICE + 499, 3804)).toBeGreaterThan(0.28);
    expect(margin(BUNDLE_PRICE + 799, 4938)).toBeGreaterThan(0.33);
  });
  it("pairing: hoodie+tee bundle first, leftover tees pair, odd tee full price", () => {
    const u = priceUnits([{ garment: "tee", size: "M", qty: 3 }, { garment: "hoodie", size: "M", qty: 1 }, { garment: "mug", size: "11oz", qty: 1 }]);
    expect(u.map((x) => [x.amount, x.deal])).toEqual([[2600, "bundle"], [2600, "twoTees"], [2600, "twoTees"], [4600, "bundle"], [2000, null]]);
    expect(savings([{ garment: "tee", size: "M", qty: 1 }])).toBe(0);
    expect(savings([{ garment: "hoodie", size: "M", qty: 2 }])).toBe(0);
  });
  it("Stripe session: reduced inline prices named with the deal, same tax codes, deals metadata", () => {
    const lines = parseCart([{ slug: "blame-the-tequila", garment: "tee", size: "M", qty: 1 }, { slug: "blame-the-tequila", garment: "hoodie", size: "2XL", qty: 1 }])!;
    const p = buildSessionParams(lines, "https://x", env);
    const li = p.line_items!.map((l) => l.price_data!);
    expect(li.map((l) => l.unit_amount)).toEqual([2600, 4600]);
    expect(li[0].product_data!.name).toContain("Tee + Hoodie bundle");
    expect(li.map((l) => l.product_data!.tax_code)).toEqual(["txcd_30011000", "txcd_30011000"]);
    expect(p.metadata).toMatchObject({ kind: "daily_drop", deals: "bundle:1,two_tees:0" });
    expect(p.shipping_options![0].shipping_rate_data!.fixed_amount!.amount).toBe(799);
    const two = buildSessionParams(parseCart([{ slug: "day-drinking", garment: "tee", size: "M", qty: 2 }])!, "https://x", env);
    expect(two.line_items!.map((l) => [l.quantity, l.price_data!.unit_amount])).toEqual([[2, 2600]]);
  });
  it("admin test checkout keeps cost pricing (no deals stacked)", () => {
    const lines = parseCart([{ slug: "day-drinking", garment: "tee", size: "M", qty: 2 }])!;
    const p = buildSessionParams(lines, "https://x", env, { adminTest: true });
    expect(p.metadata?.admin_test).toBe("true");
    expect(p.metadata?.deals).toBeUndefined();
  });
  it("Printful draft has exactly the bought items", () => {
    const lines = parseCart([{ slug: "day-drinking", garment: "tee", size: "L", qty: 1 }, { slug: "day-drinking", garment: "hoodie", size: "M", qty: 1 }])!;
    const o = buildPrintfulOrder({ id: "cs_test_x", customer_details: { address: { country: "US" } } } as unknown as Stripe.Checkout.Session, lines, "https://x", env);
    expect(o.items.map((i) => [i.variant_id, i.quantity, i.files[0].type])).toEqual([[4018, 1, "front"], [5595, 1, "front"]]);
  });
});
