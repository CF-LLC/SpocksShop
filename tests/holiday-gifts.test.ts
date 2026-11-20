import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUY_DIRECT_COPY, DEPOP_URL_RE, HOLIDAY_PATH, UNDER_10_CENTS, UNDER_20_CENTS, giftGuideSectionIds, holidayGiftSections, inGiftSection } from "../lib/shop/holiday-gifts";

const item = (priceCents: number, id = String(priceCents)) => ({ id, priceCents });

describe("holidayGiftSections", () => {
  it("splits live catalog prices into under $10 and $10–under $20, cheapest first, and leaves $20+ out", () => {
    const { under10, from10to20, total } = holidayGiftSections([
      item(2000, "twenty"),
      item(1999, "just-under-20"),
      item(1000, "ten"),
      item(300, "three"),
      item(999, "9.99"),
      item(0, "zero"),
      item(5000, "fifty"),
    ]);
    expect(under10.map((p) => p.id)).toEqual(["zero", "three", "9.99"]);
    expect(from10to20.map((p) => p.id)).toEqual(["ten", "just-under-20"]);
    expect(total).toBe(5);
    expect(UNDER_10_CENTS).toBe(1000);
    expect(UNDER_20_CENTS).toBe(2000);
  });

  it("does not invent items when the catalog is empty", () => {
    expect(holidayGiftSections([])).toEqual({ under10: [], from10to20: [], total: 0 });
  });
});

describe("buy-direct copy", () => {
  it("mentions skipping marketplace fees and shipping together, without a specific dollar saving or a price change", () => {
    expect(BUY_DIRECT_COPY).toMatch(/depop/i);
    expect(BUY_DIRECT_COPY).toMatch(/skip marketplace fees/i);
    expect(BUY_DIRECT_COPY).toMatch(/often cheaper than marketplaces/i);
    expect(BUY_DIRECT_COPY).toMatch(/ship together/i);
    expect(BUY_DIRECT_COPY).not.toMatch(/\$\d/);
    expect(BUY_DIRECT_COPY).not.toMatch(/\d+\s*%/);
    expect(BUY_DIRECT_COPY.toLowerCase()).not.toContain("guaranteed");
  });
});

describe("holiday page is linked and listed", () => {
  it("is in the sitemap, footer, and shop page", () => {
    expect(HOLIDAY_PATH).toBe("/holiday");
    const sitemap = readFileSync("app/sitemap.ts", "utf8");
    const footer = readFileSync("components/site-footer.tsx", "utf8");
    const shop = readFileSync("app/shop/page.tsx", "utf8");
    const product = readFileSync("app/shop/[slug]/page.tsx", "utf8");
    expect(sitemap).toContain('"/holiday"');
    expect(footer).toContain('"/holiday"');
    expect(shop).toContain(HOLIDAY_PATH);
    expect(shop).toContain("BuyDirectNote");
    expect(product).toContain("BuyDirectNote");
  });
});

describe("gift guide sections", () => {
  it("puts under-$10 Closet items in Under $10, cheapest first, and never puts an Amazon pick there", () => {
    const closet = [
      { title: "LEGO polybag", priceCents: 799 },
      { title: "Pin", priceCents: 300 },
      { title: "Jacket", priceCents: 2500 },
    ];
    expect(inGiftSection(closet, "under10").map((p) => p.title)).toEqual(["Pin", "LEGO polybag"]);
    expect(giftGuideSectionIds({ title: "LEGO Star Destroyer set", category: "spock" })).not.toContain("under10");
    expect(giftGuideSectionIds({ title: "Cheap gadget", blurb: "under $10 on Amazon", category: "spock" })).not.toContain("under10");
  });

  it("places novelty and Space/Star Trek Amazon picks in white elephant, and skips plain necessities", () => {
    expect(giftGuideSectionIds({ title: "Funko Pop of Spock", priceCents: 1500 })).toContain("whiteElephant");
    expect(giftGuideSectionIds({ title: "Star Trek communicator badge", category: "star-trek" })).toContain("whiteElephant");
    expect(giftGuideSectionIds({ title: "Paper towels 12-pack", category: "necessities" })).toEqual([]);
  });

  it("uses title wording for him/her and allows an item to appear in more than one section", () => {
    const mug = { title: "Funny white elephant mug for him", priceCents: 800 };
    expect(giftGuideSectionIds(mug).sort()).toEqual(["forHim", "under10", "whiteElephant"]);
    expect(giftGuideSectionIds({ title: "Women's winter coat", priceCents: 1800 })).toEqual(["forHer"]);
    expect(giftGuideSectionIds({ title: "Men's hoodie", category: "spock" })).toContain("forHim");
  });
});

describe("holiday gift guide page wiring", () => {
  it("is linked from the main nav and does not put a Depop URL on the shopper-facing page", () => {
    const nav = readFileSync("lib/nav.ts", "utf8");
    const page = readFileSync("app/holiday/page.tsx", "utf8");
    const banner = readFileSync("lib/shop/holiday-banner.ts", "utf8");
    expect(nav).toMatch(/href: "\/holiday"/);
    expect(banner).toContain('"/holiday"');
    expect(page).toContain("activeAffiliateItems");
    expect(page).toContain("AMAZON_ASSOCIATES_DISCLOSURE");
    expect(page).toContain("AffiliateCard");
    expect(page).toContain("ClosetBundleBanner");
    expect(page).toContain("BUNDLE_WHITE_ELEPHANT_LINE");
    expect(page).not.toMatch(DEPOP_URL_RE);
    expect(BUY_DIRECT_COPY).not.toMatch(DEPOP_URL_RE);
  });
});
