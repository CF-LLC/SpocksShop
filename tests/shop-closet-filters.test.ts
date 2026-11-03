import { readFileSync } from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { alternate, applyClosetQuery, categoryOf, closetHref, facets, FEATURE_EVERY, interleave, parseClosetQuery, sizeOf } from "@/lib/shop/closet-filters";
import { dropFeatures } from "@/lib/shop/features";
import { FeatureCard } from "@/components/shop/feature-card";
import { DEFAULT_HELD_SLUGS } from "@/lib/drop/config";

const items = [
  { key: "1", title: "Red lace corset top #corset", description: "Size: S / US 4-6", priceCents: 1200, listedAt: "2026-10-01" },
  { key: "2", title: "White milk glass grape goblet", description: "", priceCents: 600, listedAt: "2026-10-03" },
  { key: "3", title: "Brown leather lace-up boots", description: "size US 11", priceCents: 6000, listedAt: "2026-10-02" },
  { key: "4", title: "Nirvana white t-shirt", description: "size XXL #bandtee", priceCents: 2500, listedAt: "2026-10-04" },
  { key: "5", title: "Squishmallow rainbow cat plush", description: "", priceCents: 900, listedAt: "2026-09-01" },
];

describe("closet filters", () => {
  it("derives categories and sizes", () => {
    expect(items.map(categoryOf)).toEqual(["clothing", "glassware", "shoes", "clothing", "plush"]);
    expect(items.map(sizeOf)).toEqual(["S", null, null, "2XL", null]);
  });
  it("parses URL params and rejects junk", () => {
    expect(parseClosetQuery({ cat: "clothing", size: "s", price: "10-25", sort: "price-asc", page: "2" })).toMatchObject({ cat: "clothing", size: "S", price: "10-25", sort: "price-asc", page: 2 });
    expect(parseClosetQuery({ cat: "<x>", size: "huge", price: "free", sort: "x", page: "-3" })).toMatchObject({ cat: null, size: null, price: null, sort: "newest", page: 1 });
  });
  it("filters and sorts", () => {
    const q = parseClosetQuery({});
    expect(applyClosetQuery(items, q).map((i) => i.key)).toEqual(["4", "2", "3", "1", "5"]);
    expect(applyClosetQuery(items, { ...q, cat: "clothing", sort: "price-desc" }).map((i) => i.key)).toEqual(["4", "1"]);
    expect(applyClosetQuery(items, { ...q, price: "under-10" }).map((i) => i.key)).toEqual(["2", "5"]);
    expect(applyClosetQuery(items, { ...q, size: "2XL" }).map((i) => i.key)).toEqual(["4"]);
  });
  it("builds shareable hrefs and hides empty facets", () => {
    const q = parseClosetQuery({ cat: "clothing", page: "3" });
    expect(closetHref(q, { size: "M" })).toBe("/shop?cat=clothing&size=M");
    expect(closetHref(q, { cat: null })).toBe("/shop");
    expect(closetHref(q, { page: 4 })).toBe("/shop?cat=clothing&page=4");
    const f = facets(items);
    expect(f.categories.map((c) => c.slug)).toEqual(["plush", "shoes", "clothing", "glassware"]);
    expect(f.sizes.map((s) => s.slug)).toEqual(["S", "2XL"]);
  });
  it("inserts one feature per 12 items on row boundaries, alternating, never trailing", () => {
    const list = Array.from({ length: 30 }, (_, i) => i);
    const out = interleave(list, alternate(["A1", "A2"], ["D1"]), FEATURE_EVERY);
    const pos = out.map((r, n) => (r.kind === "feature" ? `${n}:${r.feature}` : null)).filter(Boolean);
    expect(pos).toEqual(["12:A1", "25:D1"]);
    expect(interleave(list.slice(0, 12), ["A"]).some((r) => r.kind === "feature")).toBe(false);
    expect(interleave(list, []).length).toBe(30);
  });
  it("drop features never include held designs and fall back when the drop is off", () => {
    const slugs = dropFeatures({ DAILY_DROP_ENABLED: "true" }).map((d) => d.slug);
    expect(slugs.length).toBeGreaterThan(3);
    for (const h of DEFAULT_HELD_SLUGS) expect(slugs).not.toContain(h);
    expect(dropFeatures({ DAILY_DROP_ENABLED: "false" })).toEqual([]);
  });
  it("renders both card kinds with CTA, disclosure and sponsored rel", () => {
    const a = renderToStaticMarkup(createElement(FeatureCard, { feature: { kind: "amazon", key: "a", title: "Cool Mug", line: "Nice", image: "https://m.media-amazon.com/x.jpg", amazonUrl: null, asin: "B000000001" } }));
    expect(a).toContain('rel="sponsored nofollow noopener"');
    expect(a).toContain("tag=mrspock-20");
    expect(a).toContain("As an Amazon Associate I earn from qualifying purchases.");
    expect(a).toContain("See it on Amazon");
    const d = renderToStaticMarkup(createElement(FeatureCard, { feature: { kind: "drop", key: "d", slug: "nice-pickle", title: "Nice Pickle", line: "A pickle", image: "/drop/art/x-tee.jpg", hoodie: null, fromCents: 2800 } }));
    for (const t of ['href="/drop/nice-pickle"', "Shop this design", "$28"]) expect(d).toContain(t);
  });
  it("shop page is closet-only by default", () => {
    const src = readFileSync("app/shop/page.tsx", "utf8");
    expect(src).toContain("<Filters");
    expect(src).not.toMatch(/<DailyPickSection view=\{daily\} compact/);
  });
});
