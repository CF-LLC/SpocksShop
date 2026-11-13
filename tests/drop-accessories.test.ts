import { describe, expect, it } from "vitest";
import { DESIGNS, SIZES, isHeld, printfulVariant, publicDesigns, unitPrice, type Garment } from "../lib/drop/config";
import { buildPrintfulOrder, buildSessionParams, parseCart } from "../lib/drop/core";
import { PRINTFUL_COSTS, adminCostPrice, STRIPE_PCT, STRIPE_FIXED, STRIPE_TAX_PCT, MAX_TAX_RATE } from "../lib/drop/admin-cost";
import { SHIPPING_CENTS } from "../lib/drop/config";
import type Stripe from "stripe";

const env = { PRINTFUL_VARIANTS: JSON.stringify({ "tee:M": 4017 }) };
const NEW: Garment[] = ["mug", "sticker", "hat"];

describe("mugs, stickers, hats", () => {
  it("every design offers them (white-ink v5 designs: hats only); held designs stay held", () => {
    const WHITE_INK = ["hot-mess-facts", "id-hit-that"];
    for (const d of DESIGNS) for (const g of NEW) if (!WHITE_INK.includes(d.slug) || g === "hat") expect(d.garments).toContain(g);
    expect(publicDesigns({}).map((d) => d.slug)).toContain("nice-pickle");
    expect(isHeld("nice-melons", {})).toBe(false);
    expect(isHeld("nice-melons", { DROP_HELD_SLUGS: "nice-melons" })).toBe(true);
  });
  it("every option maps to a built-in Printful variant matching the cost table", () => {
    for (const g of NEW) for (const s of SIZES[g]) {
      const v = printfulVariant(g, s, env);
      expect(v).toBeGreaterThan(0);
      expect(PRINTFUL_COSTS[`${g}:${s}`].variant).toBe(v);
    }
    expect(printfulVariant("mug", "11oz", { PRINTFUL_VARIANTS: "not json" })).toBe(1320);
    expect(printfulVariant("tee", "S", env)).toBeNull(); // tee/hoodie still env-only
  });
  it("public price + shipping keeps >= $3 margin over Printful cost and Stripe fees", () => {
    for (const g of NEW) for (const s of SIZES[g]) {
      const c = PRINTFUL_COSTS[`${g}:${s}`];
      const rev = unitPrice(g, s) + SHIPPING_CENTS[g];
      const fees = rev * STRIPE_PCT * (1 + MAX_TAX_RATE) + STRIPE_FIXED + rev * STRIPE_TAX_PCT;
      expect(rev - fees - (c.item + c.ship + c.pfTax)).toBeGreaterThan(300);
    }
  });
  it("checkout: inline price, right tax code, kind=daily_drop, highest flat shipping", () => {
    const lines = parseCart([{ slug: "blame-the-tequila", garment: "mug", size: "15oz", qty: 1 }, { slug: "day-drinking", garment: "sticker", size: "3in", qty: 2 }])!;
    expect(lines).not.toBeNull();
    const p = buildSessionParams(lines, "https://x", env);
    expect(p.metadata?.kind).toBe("daily_drop");
    expect(p.line_items![0].price_data!.unit_amount).toBe(2400);
    expect(p.line_items![1].price_data!.unit_amount).toBe(700);
    expect(p.line_items![0].price_data!.product_data!.tax_code).toBe("txcd_99999999");
    expect(p.shipping_options![0].shipping_rate_data!.fixed_amount!.amount).toBe(799);
    const hat = buildSessionParams(parseCart([{ slug: "day-drinking", garment: "hat", size: "Navy", qty: 1 }])!, "https://x", env);
    expect(hat.line_items![0].price_data!.product_data!.tax_code).toBe("txcd_30011000");
    expect(parseCart([{ slug: "day-drinking", garment: "hat", size: "M" }])).toBeNull();
  });
  it("Printful order uses the type's placement and variant", () => {
    const lines = parseCart([{ slug: "day-drinking", garment: "hat", size: "Black", qty: 1 }, { slug: "day-drinking", garment: "mug", size: "11oz", qty: 1 }])!;
    const o = buildPrintfulOrder({ id: "cs_test_123", customer_details: { address: { country: "US" } } } as unknown as Stripe.Checkout.Session, lines, "https://spockshop.com", env);
    expect(o.items.map((i) => [i.variant_id, i.files[0].type])).toEqual([[7854, "front_dtf_hat"], [1320, "default"]]);
  });
  it("admin cost price exists for every accessory option", () => {
    for (const g of NEW) for (const s of SIZES[g]) expect(adminCostPrice([{ slug: "day-drinking", garment: g, size: s, qty: 1 }], env)).not.toBeNull();
  });
});

describe("mockups", () => {
  it("gallery: tee/hoodie/mug mockups first, flat art last; never for held designs", async () => {
    const { gallery, heroImage, MOCKUP_FILES } = await import("../lib/drop/mockups");
    const d = DESIGNS.find((x) => x.slug === "blame-the-tequila")!;
    expect(gallery(d).map((i) => i.key)).toEqual(["tee", "hoodie", "mug", "art"]);
    expect(heroImage(d)).toBe("/drop/art/v4-07-blame-the-tequila-tee.jpg");
    for (const h of DESIGNS.filter((x) => isHeld(x.slug, {}))) {
      expect(MOCKUP_FILES.has(h.file)).toBe(false);
      expect(gallery(h).map((i) => i.key)).toEqual(["art"]);
    }
    for (const p of publicDesigns({})) expect(MOCKUP_FILES.has(p.file)).toBe(true);
  });
  it("mug order uses the same wrap position as the mockup", () => {
    const o = buildPrintfulOrder({ id: "cs_test_1", customer_details: { address: { country: "US" } } } as unknown as Stripe.Checkout.Session, parseCart([{ slug: "day-drinking", garment: "mug", size: "11oz", qty: 1 }])!, "https://x", env);
    expect(o.items[0].files[0]).toMatchObject({ type: "default", position: { left: 1705, width: 875 } });
  });
});
