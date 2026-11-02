import type { MetadataRoute } from "next";
import { getClosetProducts } from "@/lib/catalog";
import { publishedGuides } from "@/lib/guides/load";
import { GIFT_PAGES } from "@/lib/gifts/pages";
import { dropEnabled, publicDesigns } from "@/lib/drop/config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://spockshop.com";
  const pages = ["", "/shop", "/shop?tab=amazon", "/shop?tab=closet", "/picks", "/drop", "/gifts", ...GIFT_PAGES.map((g) => `/gifts/${g.slug}`), "/guides", "/about", "/contact"].map((p) => ({ url: `${base}${p}` }));
  const products = (await getClosetProducts()).map((p) => ({ url: `${base}/shop/${p.slug}`, lastModified: new Date(p.listedAt) }));
  const guides = (await publishedGuides()).map((g) => ({ url: `${base}/guides/${g.slug}`, ...(g.updatedAt ? { lastModified: new Date(g.updatedAt) } : {}) }));
  // Public Daily Drop product pages only (held designs never listed).
  const drop = dropEnabled() ? publicDesigns().map((d) => ({ url: `${base}/drop/${d.slug}` })) : [];
  return [...pages, ...drop, ...guides, ...products];
}
