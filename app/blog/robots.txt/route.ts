export const dynamic = "force-dynamic";

import { blogCanonical } from "@/lib/blog/config";

/** blog.spockshop.com/robots.txt */
export function GET() {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${blogCanonical()}sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
