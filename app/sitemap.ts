import type { MetadataRoute } from "next";
import { getClosetProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://spockshop.com";
  const pages = ["", "/shop", "/shop?tab=amazon", "/shop?tab=closet", "/about", "/contact"].map((p) => ({ url: `${base}${p}` }));
  const products = (await getClosetProducts()).map((p) => ({ url: `${base}/shop/${p.slug}`, lastModified: new Date(p.listedAt) }));
  return [...pages, ...products];
}
