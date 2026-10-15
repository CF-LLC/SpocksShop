import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toPublicPick } from "../lib/shop/public-pick";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "../lib/shop/sections";

const src = (p: string) => readFileSync(p, "utf8");

describe("Amazon Associates compliance", () => {
  it("public picks never carry price or rating fields", () => {
    const row = { id: "1", title: "T", imageUrl: null, amazonUrl: null, asin: "B0ABC12345", category: null, priceNote: "About $12.24", rating: 4.9, active: true };
    const pub = toPublicPick(row);
    expect(Object.keys(pub).sort()).toEqual(["amazonUrl", "asin", "blurb", "category", "id", "imageUrl", "title"]);
    expect(JSON.stringify(pub)).not.toMatch(/price|rating|12\.24/i);
  });
  it("affiliate card and public pages don't render prices or ratings", () => {
    for (const f of ["components/shop/affiliate-card.tsx", "app/guides/[slug]/page.tsx", "app/guides/page.tsx"]) {
      expect(src(f)).not.toMatch(/priceNote|price_note|rating|AggregateRating|"Offer"/);
    }
  });
  it("shows the exact disclosure in the footer and Amazon Picks section, without price caveats", () => {
    for (const f of ["components/site-footer.tsx", "app/shop/page.tsx", "app/guides/[slug]/page.tsx"]) expect(src(f)).toContain("AMAZON_ASSOCIATES_DISCLOSURE");
    expect(src("components/site-footer.tsx")).not.toMatch(/prices are approximate/i);
    expect(src("app/shop/page.tsx")).not.toMatch(/Prices are approximate/i);
    expect(AMAZON_ASSOCIATES_DISCLOSURE).toBe("As an Amazon Associate I earn from qualifying purchases.");
  });
  it("admin explains prices are hidden", () => {
    expect(src("app/admin/affiliate/page.tsx")).toMatch(/hidden on the public site for Amazon Associates compliance/);
  });
});

import { toPublicPick as toPick } from "../lib/shop/public-pick";
describe("public pick blurb", () => {
  it("carries the curator blurb but still no price fields", () => {
    const p = toPick({ id: "1", title: "T", imageUrl: null, amazonUrl: null, asin: null, category: "spock", blurb: "Nice.", priceNote: "About $5" } as never);
    expect(p.blurb).toBe("Nice.");
    expect(JSON.stringify(p)).not.toMatch(/price/i);
  });
});
