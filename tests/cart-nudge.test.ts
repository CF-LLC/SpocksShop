import { describe, expect, it } from "vitest";
import { cartBundleNudge, SHIPPING_CLOSE_RATIO } from "../lib/commerce/cart-nudge";
import type { ShippingRateRow } from "../lib/commerce/shipping";
import { BUNDLE_PATH, BUNDLE_PRICE_CENTS, BUNDLE_SIZES } from "../lib/shop/closet-bundle";

const RATES: ShippingRateRow[] = [
  { id: "r1", name: "Up to 1 lb", minWeightLb: "0", maxWeightLb: "1", amountCents: 599, isActive: true },
  { id: "r2", name: "1–5 lb", minWeightLb: "1.01", maxWeightLb: "5", amountCents: 999, isActive: true },
  { id: "r3", name: "5–20 lb", minWeightLb: "5.01", maxWeightLb: "20", amountCents: 1999, isActive: true },
];

function closet(priceCents: number, weightLb = 0.5, qty = 1, sku = "SRS-TOP-1"): Parameters<typeof cartBundleNudge>[0]["lines"][number] {
  return { source: "closet", priceCents, quantity: qty, weightLb, sku };
}

describe("cartBundleNudge", () => {
  it("hides when the cart is empty, mixed, or already has the bundle", () => {
    expect(cartBundleNudge({ lines: [], rates: RATES }).show).toBe(false);
    expect(cartBundleNudge({ lines: [closet(400), { source: "community", priceCents: 400, quantity: 1, weightLb: 0.5, sku: "COM-1" }], rates: RATES }).show).toBe(false);
    expect(
      cartBundleNudge({
        lines: [{ source: "closet", priceCents: BUNDLE_PRICE_CENTS, quantity: 1, weightLb: 2.5, sku: BUNDLE_SIZES[2].sku }],
        rates: RATES,
      }).show,
    ).toBe(false);
  });

  it("hides when shipping is well under the item total or cannot be quoted", () => {
    expect(cartBundleNudge({ lines: [closet(4000)], rates: RATES }).show).toBe(false);
    expect(cartBundleNudge({ lines: [closet(400, 0)], rates: RATES }).show).toBe(false);
    expect(cartBundleNudge({ lines: [closet(400)], rates: [] }).show).toBe(false);
  });

  it("shows when shipping exceeds a cheap Closet subtotal, using the live weight table", () => {
    const nudge = cartBundleNudge({ lines: [closet(400, 0.5)], rates: RATES });
    expect(nudge.show).toBe(true);
    if (!nudge.show) return;
    expect(nudge.shippingCents).toBe(599);
    expect(nudge.subtotalCents).toBe(400);
    expect(nudge.shippingVsItems).toBe("exceeds");
    expect(nudge.bundleHref).toBe(BUNDLE_PATH);
    expect(nudge.bundlePriceCents).toBe(BUNDLE_PRICE_CENTS);
    expect(nudge.shippingLine).toContain("$5.99");
    expect(nudge.shippingLine).toContain("$4.00");
    expect(nudge.addMoreCount).toBe(1);
    expect(nudge.addMoreLine).toMatch(/Add 1 more Closet item/);
    expect(nudge.addMoreLine).toContain("$5.99");
  });

  it("shows when shipping is close to (at least 80% of) the item total", () => {
    expect(SHIPPING_CLOSE_RATIO).toBe(0.8);
    // $5.99 shipping vs $7.00 items is about 86%.
    const nudge = cartBundleNudge({ lines: [closet(700, 0.5)], rates: RATES });
    expect(nudge.show).toBe(true);
    if (!nudge.show) return;
    expect(nudge.shippingVsItems).toBe("close");
    expect(nudge.shippingLine).toMatch(/close to your \$7\.00 item total/);
  });

  it("does not offer add-more when the cart already fills the current weight band", () => {
    const nudge = cartBundleNudge({ lines: [closet(300, 0.5), closet(300, 0.5, 1, "SRS-TOP-2")], rates: RATES });
    expect(nudge.show).toBe(true);
    if (!nudge.show) return;
    expect(nudge.weightLb).toBe(1);
    expect(nudge.shippingCents).toBe(599);
    expect(nudge.addMoreCount).toBeNull();
    expect(nudge.addMoreLine).toBeNull();
  });
});
