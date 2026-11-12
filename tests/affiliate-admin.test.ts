import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AffiliateCatalog, type AffiliateCatalogItem } from "@/app/admin/affiliate/catalog";
import { ImportPreviewGrid } from "@/components/admin/affiliate-import-preview";
import { AffiliateShopPreview } from "@/components/admin/affiliate-preview";
import { affiliateItemSchema, affiliateItemWrite } from "@/lib/admin/forms";
import { catalogCounts, filterAffiliateItems, importPreviewCards, missingCopy, moveId, parseAmazonPaste, planSortOrder } from "@/lib/admin/affiliate-catalog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const base = { title: "Lamp", asin: "B0ABC12345", active: "on" };

describe("affiliate item schema", () => {
  it("saves blurb, why, and full title and clears blank optional fields", () => {
    const saved = affiliateItemWrite(affiliateItemSchema.parse({
      ...base,
      blurb: "  Soft light  ",
      why: "Because it glows",
      fullTitle: "Full lamp title",
      amazonUrl: "https://www.amazon.com/dp/B0ABC12345?tag=other-20",
      priceNote: "",
      imageUrl: "  ",
    }));
    expect(saved).toMatchObject({
      blurb: "Soft light",
      why: "Because it glows",
      fullTitle: "Full lamp title",
      priceNote: null,
      imageUrl: null,
      asin: "B0ABC12345",
      active: true,
    });
    expect(saved.amazonUrl).toContain("tag=mrspock-20");
    expect(saved.amazonUrl).not.toContain("other-20");
  });

  it("turns an empty curator field into null instead of leaving the old value", () => {
    const cleared = affiliateItemWrite(affiliateItemSchema.parse({ ...base, blurb: "", why: "   ", fullTitle: "", priceNote: "About $1" }));
    expect(cleared.blurb).toBeNull();
    expect(cleared.why).toBeNull();
    expect(cleared.fullTitle).toBeNull();
    expect(cleared.priceNote).toBe("About $1");
  });

  it("still requires a URL or ASIN", () => {
    expect(affiliateItemSchema.safeParse({ title: "Lamp", blurb: "Hi" }).success).toBe(false);
  });
});

describe("catalog helpers", () => {
  const items = [
    { id: "1", title: "Duck", fullTitle: "Spock duck", blurb: "Quack", why: null, asin: "B0D9NS9RT5", category: "spock", active: true, imageUrl: "https://img/a.jpg" },
    { id: "2", title: "Towels", fullTitle: null, blurb: null, why: "Soft", asin: "B0DF8RSVJK", category: "home", active: false, imageUrl: null },
    { id: "3", title: "Mug", fullTitle: null, blurb: "Tea", why: null, asin: null, category: null, active: true, imageUrl: null },
  ];

  it("filters by search, category, and active", () => {
    expect(filterAffiliateItems(items, { q: "quack" }).map((i) => i.id)).toEqual(["1"]);
    expect(filterAffiliateItems(items, { q: "B0DF8RSVJK" }).map((i) => i.id)).toEqual(["2"]);
    expect(filterAffiliateItems(items, { category: "home" }).map((i) => i.id)).toEqual(["2"]);
    expect(filterAffiliateItems(items, { category: "none" }).map((i) => i.id)).toEqual(["3"]);
    expect(filterAffiliateItems(items, { status: "hidden" }).map((i) => i.id)).toEqual(["2"]);
    expect(filterAffiliateItems(items, { status: "live", q: "mug" }).map((i) => i.id)).toEqual(["3"]);
  });

  it("counts live and hidden picks", () => {
    expect(catalogCounts(items)).toEqual({ live: 2, hidden: 1, total: 3 });
  });

  it("flags missing blurb or image", () => {
    expect(missingCopy(items[0])).toEqual([]);
    expect(missingCopy(items[1])).toEqual(["blurb", "image"]);
    expect(missingCopy(items[2])).toEqual(["image"]);
  });

  it("moves ids and refuses a partial reorder", () => {
    expect(moveId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    const ids = ["a", "b", "c"];
    expect(moveId(ids, "a", "up")).toBe(ids);
    expect(planSortOrder(["a", "b"], ["b", "a"])).toEqual({ ok: true, rows: [{ id: "b", sortOrder: 0 }, { id: "a", sortOrder: 1 }] });
    expect(planSortOrder(["a", "b"], ["a"]).ok).toBe(false);
    expect(planSortOrder(["a", "b"], ["a", "a"]).ok).toBe(false);
  });

  it("parses an Amazon URL or ASIN into a tagged link", () => {
    expect(parseAmazonPaste(" b0abc12345 ")).toMatchObject({ asin: "B0ABC12345" });
    expect(parseAmazonPaste("b0abc12345")?.amazonUrl).toBe("https://www.amazon.com/dp/B0ABC12345?tag=mrspock-20");
    const url = parseAmazonPaste("https://www.amazon.com/dp/B0ABC12345?tag=other-20");
    expect(url?.asin).toBe("B0ABC12345");
    expect(url?.amazonUrl).toContain("tag=mrspock-20");
    expect(url?.amazonUrl).not.toContain("other-20");
    expect(parseAmazonPaste("https://example.com/dp/B0ABC12345")).toBeNull();
    expect(parseAmazonPaste("nope")).toBeNull();
  });

  it("builds import preview cards without prices", () => {
    const parsed = importPreviewCards([{ title: "Duck", asin: "B0D9NS9RT5", price: "$12.24", image_url: "https://img.example/a.jpg", blurb: "Quack", category: "spock" }]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cards[0]).toEqual({ title: "Duck", imageUrl: "https://img.example/a.jpg", blurb: "Quack", asin: "B0D9NS9RT5", category: "spock" });
    expect(JSON.stringify(parsed.cards)).not.toMatch(/12\.24|price/i);
    const html = renderToStaticMarkup(createElement(ImportPreviewGrid, { cards: parsed.cards }));
    expect(html).toContain("https://img.example/a.jpg");
    expect(html).toContain("Quack");
    expect(html).not.toMatch(/12\.24|priceNote|\$/);
  });
});

describe("affiliate admin markup", () => {
  const item: AffiliateCatalogItem = {
    id: "1", title: "Spock duck", fullTitle: "Official duck", blurb: null, why: null,
    imageUrl: null, amazonUrl: "https://www.amazon.com/dp/B0D9NS9RT5?tag=mrspock-20", asin: "B0D9NS9RT5",
    priceNote: "About $12.24, price may vary on Amazon", category: "spock", active: true, sortOrder: 0,
    clicks: { n: 4, d7: 1, d30: 3 },
  };

  it("renders the catalog without the internal price note", () => {
    const html = renderToStaticMarkup(createElement(AffiliateCatalog, {
      items: [item],
      totals: { n: 4, d7: 1, d30: 3 },
      unattributed: { n: 0, d7: 0, d30: 0 },
      daily: [{ day: "2026-11-12", n: 1 }],
      today: { id: "1", title: "Spock duck", why: "A fun one.", date: "2026-11-12", locked: true },
      tomorrow: null,
      nextSortOrder: 1,
    }));
    expect(html).toContain("Spock duck");
    expect(html).toContain("B0D9NS9RT5");
    expect(html).toContain("Needs a blurb and an image");
    expect(html).toContain("4 outbound clicks");
    expect(html).toContain(">1</strong> live");
    expect(html).toContain("Daily Pick");
    expect(html).toContain("data-testid=\"affiliate-click-totals\"");
    expect(html).not.toMatch(/12\.24|priceNote|star rating/i);
  });

  it("previews the shop card without prices or ratings", () => {
    const html = renderToStaticMarkup(createElement(AffiliateShopPreview, {
      item: { title: "Duck", blurb: "Hand picked.", imageUrl: "https://img.example/a.jpg", asin: "B0ABC12345", amazonUrl: "https://www.amazon.com/dp/B0ABC12345?tag=other-20", priceNote: "About $12.24", rating: 5 } as never,
    }));
    expect(html).toContain("Duck");
    expect(html).toContain("Hand picked.");
    expect(html).toContain("View on Amazon");
    expect(html).toContain("tag=mrspock-20");
    expect(html).toContain('rel="sponsored nofollow noopener"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('data-asin="B0ABC12345"');
    expect(html).not.toContain("other-20");
    expect(html).not.toMatch(/12\.24|priceNote|rating|stars/i);
  });

  it("updates through the write helper and still counts clicks on the existing beacon", () => {
    const update = readFileSync("app/api/admin/affiliate/[id]/route.ts", "utf8");
    expect(update).toContain("affiliateItemWrite");
    expect(update).not.toContain("imageUrl: null, amazonUrl: null");
    expect(update).toContain('form.has("sortOrder")');
    const tracker = readFileSync("components/analytics.tsx", "utf8");
    expect(tracker).toContain('track("amazon_click"');
    expect(tracker).toContain("amazonClickRef");
    expect(tracker).not.toContain("affiliate_clicks");
  });
});
