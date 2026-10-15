/**
 * Host-based routing for blog.spockshop.com. Pure so it can be unit-tested; middleware.ts applies it.
 *   blog.spockshop.com/            -> /blog
 *   blog.spockshop.com/<slug>      -> /blog/<slug>
 *   blog.spockshop.com/rss.xml     -> /blog/rss.xml (same for sitemap.xml, robots.txt)
 *   blog.spockshop.com/blog/<x>    -> 308 to blog.spockshop.com/<x> (one canonical URL per post)
 *   blog.spockshop.com/shop etc.   -> 308 to the main site
 * Assets (/_next, /media, icons) and /api pass through untouched.
 */
export type HostDecision = { type: "next" } | { type: "rewrite"; path: string } | { type: "redirect"; url: string };

const PASS = [/^\/_next\//, /^\/api\//, /^\/media\//, /^\/(favicon\.ico|icon[^/]*|apple-icon[^/]*|manifest\.webmanifest)$/];
const MAIN_SITE = /^\/(shop|guides|about|contact|checkout|sell|admin|cart|hunt|faq|categories|wishlist|account)(\/|$)/;

export function hostOf(headers: { get(name: string): string | null }): string {
  const raw = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function blogHostDecision(host: string, pathname: string, opts: { blogHost: string; mainOrigin: string }): HostDecision {
  if (host !== opts.blogHost) return { type: "next" };
  if (PASS.some((r) => r.test(pathname))) return { type: "next" };
  if (pathname === "/blog" || pathname.startsWith("/blog/")) {
    const rest = pathname.slice("/blog".length) || "/";
    return { type: "redirect", url: `https://${opts.blogHost}${rest}` };
  }
  if (MAIN_SITE.test(pathname)) return { type: "redirect", url: `${opts.mainOrigin}${pathname}` };
  return { type: "rewrite", path: pathname === "/" ? "/blog" : `/blog${pathname}` };
}
