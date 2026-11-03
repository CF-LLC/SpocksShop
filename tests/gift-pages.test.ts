import { describe, expect, it } from "vitest";
import { GIFT_PAGES, designsFor } from "../lib/gifts/pages";
import { DESIGNS, DEFAULT_HELD_SLUGS } from "../lib/drop/config";
import { itemListLd, ldScript } from "../lib/gifts/jsonld";

describe("gift landing pages", () => {
  it("8-12 pages with unique slugs, titles, descriptions, h1s", () => {
    expect(GIFT_PAGES.length).toBeGreaterThanOrEqual(8);
    expect(GIFT_PAGES.length).toBeLessThanOrEqual(12);
    for (const k of ["slug", "title", "description", "h1"] as const) expect(new Set(GIFT_PAGES.map((p) => p[k])).size).toBe(GIFT_PAGES.length);
    for (const p of GIFT_PAGES) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.description.length).toBeLessThanOrEqual(165);
      expect(p.description.length).toBeGreaterThan(80);
      expect(p.intro.length).toBeGreaterThan(120);
    }
  });
  it("references only real designs, never held ones, and always shows something", () => {
    for (const p of GIFT_PAGES) {
      if (p.designs !== "all") for (const s of p.designs) { expect(DESIGNS.some((d) => d.slug === s)).toBe(true); expect([...DEFAULT_HELD_SLUGS]).not.toContain(s); }
      const ds = designsFor(p.designs, {});
      expect(ds.length).toBeGreaterThan(0);
      for (const d of ds) expect([...DEFAULT_HELD_SLUGS]).not.toContain(d.slug);
    }
  });
  it("copy has no Depop, address, or rating claims", () => {
    const all = JSON.stringify(GIFT_PAGES).toLowerCase();
    for (const bad of ["depop", "rating", "review", "best-selling", "bestseller", "star trek", "street"]) expect(all).not.toContain(bad);
  });
  it("JSON-LD: products with real price range, no ratings, script-safe", () => {
    const ld = ldScript([itemListLd("x", designsFor("all", {}))]);
    expect(ld).not.toMatch(/aggregateRating|"review"|"Review"/);
    expect(ld).not.toContain("</");
    const j = JSON.parse(ld);
    expect(j["@graph"][0].itemListElement[0].item.offers).toMatchObject({ lowPrice: "7.00", highPrice: "48.00", priceCurrency: "USD" });
  });
});

describe("sized images", () => {
  it("maps art/mockup URLs to 480/800 webp variants that exist for every public design", async () => {
    const { sizedImg, SIZED_NAMES } = await import("../lib/drop/mockups");
    const { existsSync } = await import("fs");
    const r = sizedImg("/drop/art/v4-10-day-drinking-tee.jpg");
    expect(r.src).toBe("/drop/art/v4-10-day-drinking-tee-480.webp");
    expect(r.srcSet).toContain("-800.webp 800w");
    for (const n of [...SIZED_NAMES].filter((x) => !x.startsWith("v5-"))) { // v5 held: no sized variants until released
      expect(existsSync(`drop-art/sized/${n}`), n).toBe(true);
    }
  });
});
