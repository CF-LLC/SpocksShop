import { describe, expect, it } from "vitest";
import { planSampleRemoval, SEEDED_SAMPLE_PRODUCTS } from "../lib/sample-products";

const row = (sku: string, slug: string, extra: Partial<{ source: string; orderLines: number }> = {}) => ({ id: sku, sku, slug, title: sku, source: "closet", orderLines: 0, ...extra });

describe("sample product removal plan", () => {
  it("lists all 14 seed pairs", () => {
    expect(SEEDED_SAMPLE_PRODUCTS).toHaveLength(14);
    expect(new Set(SEEDED_SAMPLE_PRODUCTS.map((p) => p.sku)).size).toBe(14);
  });
  it("needs both sku and slug to match, and only closet rows", () => {
    const plan = planSampleRemoval([
      row("SRS-CL-2418", "pendleton-wool-overcoat-charcoal"),
      row("SRS-SH-1902", "a-real-item-cooper-renamed"),
      row("SRS-EL-6720", "sony-cassette-boombox-cfd-s70", { source: "community" }),
    ]);
    expect(plan.remove.map((r) => r.sku)).toEqual(["SRS-CL-2418"]);
  });
  it("refuses products with orders", () => {
    const plan = planSampleRemoval([row("SRS-CL-2418", "pendleton-wool-overcoat-charcoal", { orderLines: 1 })]);
    expect(plan.remove).toEqual([]);
    expect(plan.keep).toHaveLength(1);
  });
});
