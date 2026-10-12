import { describe, expect, it } from "vitest";
import { affiliateItemSchema, parseClosetForm, reorder, slugify } from "../lib/admin/forms";
import { AdminInputError } from "../lib/admin/http";

function fd(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("admin forms", () => {
  it("slugifies titles", () => {
    expect(slugify("Spock's Café Mug — Blue!")).toBe("spock-s-cafe-mug-blue");
  });
  it("parses a closet item into cents and closet source", () => {
    const { product, quantity } = parseClosetForm(fd({ title: "Wool Coat", sku: "srs-1", price: "92.50", quantity: "1", status: "listed", condition: "Good" }));
    expect(product).toMatchObject({ sku: "SRS-1", slug: "wool-coat", priceCents: 9250, source: "closet", featured: false, uniqueFind: true });
    expect(quantity).toBe(1);
  });
  it("rejects bad closet input", () => {
    expect(() => parseClosetForm(fd({ title: "x", sku: "", price: "-1", quantity: "1", status: "listed", condition: "Good" }))).toThrow(AdminInputError);
  });
  it("requires an Amazon URL or ASIN", () => {
    expect(affiliateItemSchema.safeParse({ title: "Lamp" }).success).toBe(false);
    expect(affiliateItemSchema.safeParse({ title: "Lamp", asin: "b0abc12345" }).success).toBe(true);
    expect(affiliateItemSchema.safeParse({ title: "Lamp", asin: "short" }).success).toBe(false);
  });
  it("reorders and ignores out-of-range moves", () => {
    expect(reorder(["a", "b", "c"], 1, "up")).toEqual(["b", "a", "c"]);
    expect(reorder(["a", "b", "c"], 2, "down")).toEqual(["a", "b", "c"]);
  });
});
