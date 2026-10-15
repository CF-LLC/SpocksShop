import { blogCanonical } from "@/lib/blog/config";
import { allPublished } from "@/lib/blog/repo";

export const dynamic = "force-dynamic";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const posts = await allPublished(50);
  const items = posts.map((p) => `<item><title>${x(p.title)}</title><link>${blogCanonical(p.slug)}</link><guid isPermaLink="true">${blogCanonical(p.slug)}</guid><description>${x(p.description)}</description>${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}</item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>SpockShop Blog</title><link>${blogCanonical()}</link><atom:link href="${blogCanonical()}rss.xml" rel="self" type="application/rss+xml"/><description>Space gifts, guides and explainers from Spock's Resale Shop.</description><language>en-us</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
