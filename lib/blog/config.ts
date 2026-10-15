type Env = Record<string, string | undefined>;

export const BLOG_PAGE_SIZE = 10;

/** Public host for the blog. Cloudflare Tunnel routes it to this same app. */
export function blogHost(env: Env = process.env): string {
  return (env.BLOG_HOST?.trim() || "blog.spockshop.com").toLowerCase();
}

/** Absolute origin used for canonicals, OG, JSON-LD, RSS and the blog sitemap. */
export function blogOrigin(env: Env = process.env): string {
  return `https://${blogHost(env)}`;
}

export function blogCanonical(slug?: string, env: Env = process.env): string {
  return slug ? `${blogOrigin(env)}/${slug}` : `${blogOrigin(env)}/`;
}

/** BLOG_DRAFTS_PER_WEEK (default 3, max 14). 0 turns the scheduled generator off. */
export function draftsPerWeek(env: Env = process.env): number {
  const raw = env.BLOG_DRAFTS_PER_WEEK?.trim();
  const n = raw === undefined || raw === "" ? 3 : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), 14);
}
