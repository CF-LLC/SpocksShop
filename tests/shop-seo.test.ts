import { describe, expect, it } from "vitest";
import { cleanTitle, productSeo } from "../lib/shop/seo";

describe("closet product SEO", () => {
  it("tidies raw resale titles", () => {
    expect(cleanTitle("Saint john's bay , extra large , classic v neck")).toBe("Saint John's Bay Extra Large Classic V Neck");
    expect(cleanTitle("Vintage NASA tee, size L")).toBe("Vintage NASA Tee Size L");
    expect(cleanTitle("t-shirt of the month")).toBe("T-Shirt of the Month");
  });
  it("builds unique title/description from real fields only", () => {
    const base = { title: "star trek mug", description: "Ceramic.\nMore text", brand: "Paramount", condition: "Used - Good", priceCents: 1200, categoryName: "Home", status: "listed", available: 1 } as const;
    const s = productSeo(base as never);
    expect(s.title).toBe("Star Trek Mug by Paramount (Used - Good)");
    expect(s.description).toContain("$12, one of a kind");
    expect(s.description).toContain("Ceramic.");
    expect(s.description.length).toBeLessThanOrEqual(160);
    expect(productSeo({ ...base, available: 0 } as never).description).toContain("Sold");
  });
});
