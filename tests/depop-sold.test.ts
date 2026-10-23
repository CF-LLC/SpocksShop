import { describe, expect, it } from "vitest";
import { importDepopLinks, type ImportStore } from "../lib/depop/import";
import { parseDepopListing, soldFromHtml } from "../lib/depop/parse";
import { BOOKMARKLET_SOURCE } from "../lib/depop/bookmarklet";
import { decodeResults, encodeResults } from "../lib/depop/results";
import type { Fetcher } from "../lib/depop/fetch";

const ld = (availability?: string) => `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Vintage NASA tee", offers: { "@type": "Offer", price: "24.00", priceCurrency: "USD", ...(availability ? { availability } : {}) } })}</script>`;
const page = (head: string) => `<html><head>${head}</head></html>`;

describe("sold detection", () => {
  it("reads JSON-LD availability", () => {
    expect(soldFromHtml(page(ld("https://schema.org/SoldOut")))).toBe(true);
    expect(soldFromHtml(page(ld("https://schema.org/OutOfStock")))).toBe(true);
    expect(soldFromHtml(page(ld("https://schema.org/InStock")))).toBe(false);
    expect(soldFromHtml(page(ld()))).toBe(false);
  });
  it("reads the bookmark's sold marker and meta tags", () => {
    expect(parseDepopListing(page(ld() + '<meta property="product:availability" content="sold">')).sold).toBe(true);
    expect(soldFromHtml(page('<meta property="product:availability" content="out of stock">'))).toBe(true);
    expect(soldFromHtml(page('<meta property="product:availability" content="instock">'))).toBe(false);
  });
  it("doesn't call a listing sold because the title says 'sold'", () => {
    expect(soldFromHtml(page(`<meta property="og:title" content="Sold out tour tee">${ld("https://schema.org/InStock")}`))).toBe(false);
  });
  it("bookmarklet v3 marks sold items and still parses", () => {
    expect(BOOKMARKLET_SOURCE).toContain('v:3');
    expect(BOOKMARKLET_SOURCE).toContain('product:availability');
    expect(() => new Function(BOOKMARKLET_SOURCE)).not.toThrow();
  });
});

describe("import skips sold and already-imported listings", () => {
  it("makes no draft and downloads no photos for a sold listing", async () => {
    const created: string[] = [];
    const fetched: string[] = [];
    const store: ImportStore = {
      existing: async (urls) => new Map(urls.filter((u) => u.includes("prev")).map((u) => [u, { id: "00000000-0000-4000-8000-000000000001", title: "Old" }])),
      create: async ({ url }) => { created.push(url); },
    };
    const fetcher: Fetcher = async (url) => {
      fetched.push(url);
      const html = url.includes("sold") ? page(ld("https://schema.org/SoldOut")) : page(ld("https://schema.org/InStock"));
      return { bytes: new TextEncoder().encode(html), contentType: "text/html" };
    };
    const links = ["https://www.depop.com/products/spock13-sold-tee/", "https://www.depop.com/products/spock13-new-mug/", "https://www.depop.com/products/spock13-prev-hat/"].join("\n");
    const { results } = await importDepopLinks(links, { store, fetcher, wait: async () => {}, savePhotoBytes: async () => "x", removePhoto: async () => {} });
    expect(results.map((r) => r.status)).toEqual(["sold", "imported", "duplicate"]);
    expect(created).toEqual(["https://www.depop.com/products/spock13-new-mug/"]);
    expect(fetched.some((u) => u.includes("prev-hat"))).toBe(false);
    expect(decodeResults(encodeResults(results))?.[0]).toMatchObject({ status: "sold", title: "Vintage NASA tee" });
  });
});
