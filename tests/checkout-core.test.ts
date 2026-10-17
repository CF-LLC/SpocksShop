import { describe, expect, it } from "vitest";
import { buildSessionParams, checkoutInputSchema, mergeLines, newOrderNumber, SESSION_TTL_MINUTES } from "../lib/checkout/core";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("checkout input", () => {
  it("accepts product ids and quantities only; no prices from the client", () => {
    const parsed = checkoutInputSchema.parse({ items: [{ productId: A, quantity: 1, priceCents: 1 }], method: "ship" });
    expect(parsed.items[0]).toEqual({ productId: A, quantity: 1 });
  });
  it("rejects empty carts, bad ids, silly quantities and unknown methods", () => {
    expect(checkoutInputSchema.safeParse({ items: [], method: "ship" }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ items: [{ productId: "x", quantity: 1 }], method: "ship" }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ items: [{ productId: A, quantity: 0 }], method: "ship" }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ items: [{ productId: A, quantity: 11 }], method: "ship" }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ items: [{ productId: A, quantity: 1 }], method: "drone" }).success).toBe(false);
  });
  it("is ship-only: local pickup is rejected and the method defaults to ship", () => {
    expect(checkoutInputSchema.safeParse({ items: [{ productId: A, quantity: 1 }], method: "pickup" }).success).toBe(false);
    expect(checkoutInputSchema.parse({ items: [{ productId: A, quantity: 1 }] }).method).toBe("ship");
  });
  it("merges duplicate lines and sorts by id (lock order)", () => {
    expect(mergeLines([{ productId: B, quantity: 1 }, { productId: A, quantity: 1 }, { productId: B, quantity: 2 }])).toEqual([
      { productId: A, quantity: 1 },
      { productId: B, quantity: 3 },
    ]);
  });
  it("order numbers look like SPK-YYYYMMDD-XXXXXX", () => {
    expect(newOrderNumber(new Date("2026-10-12T12:00:00Z"))).toMatch(/^SPK-20261012-[0-9A-F]{6}$/);
  });
});

describe("buildSessionParams", () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const base = {
    orderId: A,
    orderNumber: "SPK-20261012-ABC123",
    lines: [{ productId: B, title: "Brass lamp", sku: "CL-1", unitPriceCents: 4500, quantity: 1, image: "/media/closet/x.jpg" }],
    shipping: { amountCents: 599, name: "Shipping (Up to 1 lb)" },
    origin: "https://spockshop.com",
    now,
  };

  it("uses database prices, no tax, and a single fixed shipping option", () => {
    const p = buildSessionParams({ ...base, method: "ship" });
    expect(p.mode).toBe("payment");
    expect(p.line_items?.[0].price_data?.unit_amount).toBe(4500);
    expect(p.line_items?.[0].price_data?.currency).toBe("usd");
    expect(p.line_items?.[0].price_data?.product_data?.images).toEqual(["https://spockshop.com/media/closet/x.jpg"]);
    expect(p.automatic_tax).toEqual({ enabled: false });
    expect(p.shipping_options).toHaveLength(1);
    expect(p.shipping_options?.[0].shipping_rate_data?.fixed_amount?.amount).toBe(599);
    expect(p.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(JSON.stringify(p)).not.toMatch(/pickup/i);
    expect(p.metadata).toMatchObject({ order_id: A, order_number: "SPK-20261012-ABC123" });
    expect(p.client_reference_id).toBe(A);
  });

  it("always collects a US shipping address", () => {
    const p = buildSessionParams({ ...base, method: "ship", shipping: { amountCents: 999, name: "Shipping (1–5 lb)" } });
    expect(p.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(p.shipping_options?.[0].shipping_rate_data?.fixed_amount?.amount).toBe(999);
  });

  it("expires after the reservation window and builds success/cancel URLs", () => {
    const p = buildSessionParams({ ...base, method: "ship" });
    expect(p.expires_at).toBe(Math.floor(now.getTime() / 1000) + SESSION_TTL_MINUTES * 60);
    expect(p.success_url).toBe("https://spockshop.com/checkout/success?session_id={CHECKOUT_SESSION_ID}");
    expect(p.cancel_url).toBe("https://spockshop.com/checkout/cancel?order=SPK-20261012-ABC123");
  });

  it("does not send relative image URLs on plain-http origins", () => {
    const p = buildSessionParams({ ...base, method: "ship", origin: "http://localhost:3000" });
    expect(p.line_items?.[0].price_data?.product_data?.images).toBeUndefined();
  });
});
