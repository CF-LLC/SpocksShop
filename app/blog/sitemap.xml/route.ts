import { blogCanonical } from "@/lib/blog/config";
import { allPublished } from "@/lib/blog/repo";

export const dynamic = "force-dynamic";

/** blog.spockshop.com/sitemap.xml (published posts only). */
export async function GET() {
  const posts = await allPublished();
  const urls = [`<url><loc>${blogCanonical()}</loc></url>`, ...posts.map((p) => `<url><loc>${blogCanonical(p.slug)}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`)].join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
