import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CLOSET_WEIGHT_LB, closetWeightLb } from "../lib/commerce/closet-weight";
import { parseClosetForm } from "../lib/admin/forms";
import { ClosetForm } from "../components/admin/closet-form";
import { quoteShipping, type ShippingRateRow } from "../lib/commerce/shipping";

const fd = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, x] of Object.entries(v)) f.set(k, x);
  return f;
};
const base = { title: "Vintage tee", sku: "srs-w1", price: "4", quantity: "1", status: "listed", condition: "Good" };
const rates: ShippingRateRow[] = [
  { id: "a", name: "Up to 1 lb", minWeightLb: "0.00", maxWeightLb: "1.00", amountCents: 599, isActive: true },
  { id: "b", name: "1–5 lb", minWeightLb: "1.01", maxWeightLb: "5.00", amountCents: 999, isActive: true },
  { id: "c", name: "5–20 lb", minWeightLb: "5.01", maxWeightLb: "20.00", amountCents: 1999, isActive: true },
];

describe("closet default weight", () => {
  it("defaults missing or zero weights to 0.5 lb and keeps a real weight", () => {
    expect(DEFAULT_CLOSET_WEIGHT_LB).toBe(0.5);
    expect(closetWeightLb(null)).toBe("0.5");
    expect(closetWeightLb(undefined)).toBe("0.5");
    expect(closetWeightLb("")).toBe("0.5");
    expect(closetWeightLb(0)).toBe("0.5");
    expect(closetWeightLb("0")).toBe("0.5");
    expect(closetWeightLb(1)).toBe("1");
    expect(closetWeightLb("0.75")).toBe("0.75");
  });

  it("admin create/edit uses the default when the field is blank or 0, and keeps an entered weight", () => {
    expect(parseClosetForm(fd(base)).product.weightLb).toBe("0.5");
    expect(parseClosetForm(fd({ ...base, weightLb: "" })).product.weightLb).toBe("0.5");
    expect(parseClosetForm(fd({ ...base, weightLb: "0" })).product.weightLb).toBe("0.5");
    expect(parseClosetForm(fd({ ...base, weightLb: "1" })).product.weightLb).toBe("1");
  });

  it("new Closet form prefills 0.5 lb, and an existing 1 lb item keeps its weight", () => {
    const neu = renderToStaticMarkup(createElement(ClosetForm, { action: "/x", categories: [], submitLabel: "Save", isNew: true }));
    expect(neu).toMatch(/name="weightLb"[^>]*value="0.5"/);
    const edit = renderToStaticMarkup(createElement(ClosetForm, { action: "/x", categories: [], submitLabel: "Save", values: { weightLb: "1" } }));
    expect(edit).toMatch(/name="weightLb"[^>]*value="1"/);
    expect(edit).not.toMatch(/name="weightLb"[^>]*value="0.5"/);
  });

  it("1 and 2 default-weight Closet items quote $5.99; 3 items quote $9.99", () => {
    const quote = (n: number) => {
      const weightLb = Math.round(DEFAULT_CLOSET_WEIGHT_LB * n * 100) / 100;
      return quoteShipping({ method: "ship", weightLb, rates });
    };
    expect(quote(1)).toMatchObject({ ok: true, amountCents: 599 });
    expect(quote(2)).toMatchObject({ ok: true, amountCents: 599 });
    expect(quote(3)).toMatchObject({ ok: true, amountCents: 999 });
  });
});
