import { PRICES_CENTS, SIZES, GARMENTS, unitPrice, type Design } from "@/lib/drop/config";
import { heroImage } from "@/lib/drop/mockups";

export const BASE = "https://spockshop.com";
const prices = GARMENTS.flatMap((g) => SIZES[g].map((s) => unitPrice(g, s)));
const low = (Math.min(...prices) / 100).toFixed(2), high = (Math.max(...prices) / 100).toFixed(2);

/** Product + AggregateOffer from real prices only. No ratings or reviews (we have none). */
export function productLd(d: Design) {
  return {
    "@type": "Product",
    name: d.title,
    description: d.blurb,
    image: `${BASE}${heroImage(d)}`,
    url: `${BASE}/drop/${d.slug}`,
    brand: { "@type": "Brand", name: "Spock's Resale Shop" },
    offers: { "@type": "AggregateOffer", priceCurrency: "USD", lowPrice: low, highPrice: high, offerCount: prices.length, availability: "https://schema.org/InStock" },
  };
}
export const itemListLd = (name: string, designs: Design[]) => ({
  "@type": "ItemList",
  name,
  itemListElement: designs.map((d, i) => ({ "@type": "ListItem", position: i + 1, item: productLd(d) })),
});
export const breadcrumbLd = (crumbs: [string, string][]) => ({
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${BASE}${path}` })),
});
export const ldScript = (graph: object[]) => JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
export const TEE_PRICE = PRICES_CENTS.tee;
