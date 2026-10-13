import { describe, expect, it } from "vitest";
import { buildSessionParams, DEFAULT_PRODUCT_TAX_CODE, DEFAULT_SHIPPING_TAX_CODE, taxSettings } from "../lib/checkout/core";

const base = {
  orderId: "11111111-1111-4111-8111-111111111111",
  orderNumber: "SPK-20261013-ABC123",
  lines: [{ productId: "22222222-2222-4222-8222-222222222222", title: "Lamp", sku: "SKU-1", unitPriceCents: 2500, quantity: 1, image: null }],
  shipping: { amountCents: 0, name: "Local pickup (Bentonville, AR)" },
  origin: "https://spockshop.com",
};

describe("taxSettings", () => {
  it("is off by default and only on for exactly 'true'", () => {
    expect(taxSettings({}).enabled).toBe(false);
    expect(taxSettings({ STRIPE_TAX_ENABLED: "1" }).enabled).toBe(false);
    expect(taxSettings({ STRIPE_TAX_ENABLED: " TRUE " }).enabled).toBe(true);
  });
  it("defaults to general tangible goods + shipping codes; validates overrides", () => {
    expect(taxSettings({})).toMatchObject({ productTaxCode: "txcd_99999999", shippingTaxCode: "txcd_92010001" });
    expect(taxSettings({ STRIPE_PRODUCT_TAX_CODE: "txcd_30011000" }).productTaxCode).toBe("txcd_30011000");
    expect(taxSettings({ STRIPE_PRODUCT_TAX_CODE: "bogus" }).productTaxCode).toBe(DEFAULT_PRODUCT_TAX_CODE);
  });
});

describe("buildSessionParams with Stripe Tax", () => {
  it("off: no automatic tax, no tax codes, no billing address", () => {
    const p = buildSessionParams({ ...base, method: "pickup", tax: taxSettings({}) });
    expect(p.automatic_tax).toEqual({ enabled: false });
    expect(p.billing_address_collection).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain("tax_code");
    expect(JSON.stringify(p)).not.toContain("tax_behavior");
  });
  it("on + pickup: automatic tax, exclusive prices, product + shipping codes, billing address required", () => {
    const p = buildSessionParams({ ...base, method: "pickup", tax: taxSettings({ STRIPE_TAX_ENABLED: "true" }) });
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.billing_address_collection).toBe("required");
    const li = p.line_items![0].price_data!;
    expect(li.tax_behavior).toBe("exclusive");
    expect(li.product_data!.tax_code).toBe(DEFAULT_PRODUCT_TAX_CODE);
    const ship = p.shipping_options![0].shipping_rate_data!;
    expect(ship).toMatchObject({ tax_behavior: "exclusive", tax_code: DEFAULT_SHIPPING_TAX_CODE });
  });
  it("on + ship: uses the shipping address (no extra billing requirement)", () => {
    const p = buildSessionParams({ ...base, method: "ship", shipping: { amountCents: 999, name: "Shipping" }, tax: taxSettings({ STRIPE_TAX_ENABLED: "true" }) });
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(p.billing_address_collection).toBeUndefined();
  });
});
