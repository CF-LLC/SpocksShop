import { describe, expect, it } from "vitest";
import { buildSessionParams, parseCart, promoApplies, handleDropEvent, type DropDeps } from "../lib/drop/core";
import { PRINTFUL_COSTS, STRIPE_PCT, STRIPE_FIXED, STRIPE_TAX_PCT, MAX_TAX_RATE } from "../lib/drop/admin-cost";
import { SHIPPING_CENTS, SIZES, unitPrice, GARMENTS } from "../lib/drop/config";
import { makeCode, normalizeCode, normalizeEmail, promoAmount, promoEligible, rateLimited } from "../lib/drop/signup";
import type Stripe from "stripe";

const env = { PRINTFUL_VARIANTS: JSON.stringify({ "tee:M": 4017, "tee:2XL": 4020, "hoodie:M": 5595, "hoodie:2XL": 5598 }) };
const margin = (rev: number, cost: number) => (rev - (rev * (STRIPE_PCT * (1 + MAX_TAX_RATE) + STRIPE_TAX_PCT) + STRIPE_FIXED) - cost) / rev;

describe("signup helpers", () => {
  it("validates + normalizes email", () => {
    expect(normalizeEmail("  Foo.Bar+x@Example.COM ")).toBe("foo.bar+x@example.com");
    for (const bad of ["", "a@b", "nope", "a b@c.com", "<x>@y.com", 5]) expect(normalizeEmail(bad)).toBeNull();
  });
  it("codes look like DROP10-XXXXXX and normalize", () => {
    const c = makeCode();
    expect(c).toMatch(/^DROP10-[A-Z0-9]{6}$/);
    expect(normalizeCode(` ${c.toLowerCase()} `)).toBe(c);
    expect(normalizeCode("DROP10-12")).toBeNull();
  });
  it("rate limits after 5 tries per window", () => {
    const k = `t${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(rateLimited(k, 5, 1000, 1)).toBe(false);
    expect(rateLimited(k, 5, 1000, 2)).toBe(true);
    expect(rateLimited(k, 5, 1000, 5000)).toBe(false);
  });
  it("every promo-eligible single item keeps >= 28% margin after 10% off", () => {
    for (const g of GARMENTS) for (const s of SIZES[g]) {
      const c = PRINTFUL_COSTS[`${g}:${s}`];
      const m = margin(promoAmount(unitPrice(g, s)) + SHIPPING_CENTS[g], c.item + c.ship + c.pfTax);
      if (promoEligible(g, s)) expect(m, `${g}:${s}`).toBeGreaterThanOrEqual(0.28);
    }
  });
});

describe("code at checkout", () => {
  it("10% off non-deal eligible units, named on the line, code in metadata", () => {
    const lines = parseCart([{ slug: "day-drinking", garment: "tee", size: "M", qty: 1 }])!;
    const p = buildSessionParams(lines, "https://x", env, { promoCode: "DROP10-ABC234" });
    const pd = p.line_items![0].price_data!;
    expect(pd.unit_amount).toBe(2520);
    expect(pd.product_data!.name).toContain("10% first-order code");
    expect(pd.product_data!.tax_code).toBe("txcd_30011000");
    expect(p.metadata?.promo_code).toBe("DROP10-ABC234");
  });
  it("never stacks on deal units; odd extra tee gets it; 2XL stays full", () => {
    const lines = parseCart([{ slug: "day-drinking", garment: "tee", size: "M", qty: 3 }, { slug: "day-drinking", garment: "tee", size: "2XL", qty: 1 }])!;
    // 4 tees -> two 2-tee deals, nothing eligible
    expect(promoApplies(lines)).toBe(false);
    const three = parseCart([{ slug: "day-drinking", garment: "tee", size: "M", qty: 3 }])!;
    const p = buildSessionParams(three, "https://x", env, { promoCode: "DROP10-ABC234" });
    expect(p.line_items!.map((l) => [l.quantity, l.price_data!.unit_amount])).toEqual([[2, 2600], [1, 2520]]);
    const big = parseCart([{ slug: "day-drinking", garment: "hoodie", size: "2XL", qty: 1 }])!;
    expect(promoApplies(big)).toBe(false);
  });
  it("admin test checkout ignores the code", () => {
    const lines = parseCart([{ slug: "day-drinking", garment: "tee", size: "M", qty: 1 }])!;
    const p = buildSessionParams(lines, "https://x", env, { adminTest: true, promoCode: "DROP10-ABC234" });
    expect(p.metadata?.promo_code).toBeUndefined();
  });
  it("paid webhook marks the code redeemed once", async () => {
    const used: string[] = [];
    const deps: DropDeps = { claim: async () => true, setResult: async () => {}, createPrintfulOrder: async () => ({ id: "1" }), redeemPromo: async (c) => { used.push(c); } };
    const session = { id: "cs_1", payment_status: "paid", metadata: { kind: "daily_drop", promo_code: "DROP10-ABC234", cart: JSON.stringify([["day-drinking", "tee", "M", 1]]) }, customer_details: { address: { country: "US" } } };
    await handleDropEvent({ type: "checkout.session.completed", data: { object: session } } as unknown as Stripe.Event, deps, { artBase: "https://x", autoConfirm: false, env });
    expect(used).toEqual(["DROP10-ABC234"]);
  });
});
