import { describe, expect, it } from "vitest";
import { closetShippingCopy } from "../lib/commerce/shipping-copy";
import { quoteShipping, type ShippingRateRow } from "../lib/commerce/shipping";

const liveRates: ShippingRateRow[] = [
  { id: "a", name: "Up to 1 lb", minWeightLb: "0", maxWeightLb: "1", amountCents: 599, isActive: true },
  { id: "b", name: "1–5 lb", minWeightLb: "1.01", maxWeightLb: "5", amountCents: 999, isActive: true },
  { id: "c", name: "5–20 lb", minWeightLb: "5.01", maxWeightLb: "20", amountCents: 1999, isActive: true },
];

describe("closetShippingCopy", () => {
  it("states the live weight table and that shipping is one combined-order fee", () => {
    const { text, ratesPhrase } = closetShippingCopy(liveRates);
    expect(ratesPhrase).toBe("$5.99 up to 1 lb, $9.99 for 1.01–5 lb, or $19.99 for 5.01–20 lb");
    expect(text).toContain(ratesPhrase);
    expect(text).toMatch(/one fee per US order/i);
    expect(text).toMatch(/combined weight/i);
    expect(text).toMatch(/bundle a few closet picks/i);
    expect(text.toLowerCase()).not.toContain("coming soon");
    // Do not promise a special 3-item discount that checkout does not apply.
    expect(text.toLowerCase()).not.toContain("3 or more");
    expect(text.toLowerCase()).not.toContain("free shipping");
  });

  it("matches what quoteShipping would charge for a single combined-weight order", () => {
    expect(quoteShipping({ method: "ship", weightLb: 1, rates: liveRates })).toMatchObject({ ok: true, amountCents: 599 });
    expect(quoteShipping({ method: "ship", weightLb: 3, rates: liveRates })).toMatchObject({ ok: true, amountCents: 999 });
    expect(quoteShipping({ method: "ship", weightLb: 6, rates: liveRates })).toMatchObject({ ok: true, amountCents: 1999 });
    const { text } = closetShippingCopy(liveRates);
    expect(text).toContain("$5.99");
    expect(text).toContain("$9.99");
    expect(text).toContain("$19.99");
  });

  it("falls back without inventing amounts when no rates are active", () => {
    const { text, ratesPhrase } = closetShippingCopy([]);
    expect(ratesPhrase).toBe("");
    expect(text).toMatch(/calculated at checkout/i);
    expect(text).toMatch(/bundle a few closet picks/i);
    expect(text).not.toMatch(/\$\d/);
  });

  it("ignores inactive rows", () => {
    const { text } = closetShippingCopy([
      { minWeightLb: "0", maxWeightLb: "1", amountCents: 599, isActive: true },
      { minWeightLb: "1.01", maxWeightLb: "5", amountCents: 1, isActive: false },
    ]);
    expect(text).toContain("$5.99 up to 1 lb");
    expect(text).not.toContain("$0.01");
  });
});
