import { describe, expect, it } from "vitest";
import { availableQuantity } from "../lib/commerce/inventory";
import { computeOrderTotal } from "../lib/commerce/money";
import { quoteShipping } from "../lib/commerce/shipping";
import { requireVerifiedForLive, selectTaxRates, type TaxRateRow } from "../lib/commerce/tax";
import { hashPassword, verifyPassword } from "../lib/auth/password";

const row: TaxRateRow = {
  id: "t1", jurisdiction: "Bentonville", appliesTo: "both", state: "AR", city: "Bentonville",
  postalCode: null, rate: "0.1", effectiveFrom: "2026-01-01", expiresAt: null, isActive: true, verifiedWithAuthority: false,
};

describe("commerce", () => {
  it("computes available quantity", () => {
    expect(availableQuantity({ quantityOnHand: 1, quantityReserved: 1 })).toBe(0);
    expect(availableQuantity({ quantityOnHand: 3, quantityReserved: 1 })).toBe(2);
  });
  it("totals orders and rejects negatives", () => {
    expect(computeOrderTotal({ goodsSubtotalCents: 1000, shippingCents: 500, taxCents: 100 })).toBe(1600);
    expect(() => computeOrderTotal({ goodsSubtotalCents: -1, shippingCents: 0, taxCents: 0 })).toThrow();
  });
  it("requires a positive weight and a matching rate (ship-only)", () => {
    expect(quoteShipping({ method: "ship", weightLb: 0, rates: [] }).ok).toBe(false);
    expect(quoteShipping({ method: "ship", weightLb: 2, rates: [] }).ok).toBe(false);
  });
  it("charges no tax outside AR and refuses unverified rows for live", () => {
    expect(selectTaxRates({ method: "ship", destination: { state: "TX" }, rates: [row] })).toMatchObject({ ok: true, rate: 0, reason: "no nexus" });
    const pickup = selectTaxRates({ method: "pickup", rates: [row], on: "2026-06-01" });
    expect(pickup.ok).toBe(true);
    expect(() => requireVerifiedForLive([row])).toThrow();
  });
  it("hashes and verifies passwords", () => {
    const h = hashPassword("secret");
    expect(verifyPassword("secret", h)).toBe(true);
    expect(verifyPassword("nope", h)).toBe(false);
  });
});
