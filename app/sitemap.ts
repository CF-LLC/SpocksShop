import type { MetadataRoute } from "next";
import { getClosetProducts } from "@/lib/catalog";
import { publishedGuides } from "@/lib/guides/load";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://spockshop.com";
  const pages = ["", "/shop", "/shop?tab=amazon", "/shop?tab=closet", "/picks", "/drop", "/guides", "/about", "/contact"].map((p) => ({ url: `${base}${p}` }));
  const products = (await getClosetProducts()).map((p) => ({ url: `${base}/shop/${p.slug}`, lastModified: new Date(p.listedAt) }));
  const guides = (await publishedGuides()).map((g) => ({ url: `${base}/guides/${g.slug}`, ...(g.updatedAt ? { lastModified: new Date(g.updatedAt) } : {}) }));
  return [...pages, ...guides, ...products];
}
