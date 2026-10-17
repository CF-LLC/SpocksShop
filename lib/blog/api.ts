import { createHash, timingSafeEqual } from "crypto";
import { withAffiliateTag } from "@/lib/commerce/affiliate";
import { slugify, topicKey } from "./rules";

/**
 * POST /api/blog/drafts: pure parts (auth, limits, validation) so they're unit-tested without Postgres.
 * The endpoint only ever writes status "draft"; publishing stays a one-tap admin action.
 */
type Env = Record<string, string | undefined>;

export const MAX_BODY_BYTES = 200_000;
export const MAX_TAGS = 10;
export const MAX_PRODUCT_LINKS = 12;

/** Constant-time bearer check. False when BLOG_DRAFT_TOKEN is unset or too short (the API is then off). */
export function bearerMatches(header: string | null, env: Env = process.env): boolean {
  const expected = env.BLOG_DRAFT_TOKEN?.trim();
  if (!expected || expected.length < 32) return false;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  if (!m) return false;
  // Hash both sides so lengths match and timingSafeEqual never leaks the token length.
  const a = createHash("sha256").update(m[1]).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Fixed-window limiter, in memory (one app container). */
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private limit: number, private windowMs: number) {}
  take(key: string, now = Date.now()): { ok: boolean; retryAfter: number } {
    const h = this.hits.get(key);
    if (!h || now >= h.reset) {
      this.hits.set(key, { n: 1, reset: now + this.windowMs });
      if (this.hits.size > 5000) for (const [k, v] of this.hits) if (now >= v.reset) this.hits.delete(k);
      return { ok: true, retryAfter: 0 };
    }
    h.n += 1;
    return h.n <= this.limit ? { ok: true, retryAfter: 0 } : { ok: false, retryAfter: Math.ceil((h.reset - now) / 1000) };
  }
}

export function clientKey(headers: { get(name: string): string | null }): string {
  return headers.get("cf-connecting-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/** Reads the body with a hard byte cap (Content-Length can lie or be absent). */
export async function readLimited(request: Request, max = MAX_BODY_BYTES): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return { ok: false };
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => null);
      return { ok: false };
    }
    chunks.push(value);
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}

function httpsUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && u.hostname.includes(".") && !u.username && !u.password ? u : null;
  } catch {
    return null;
  }
}

/** Amazon links get tag=mrspock-20 (replacing any other tag); other https links pass through unchanged. */
export function tagProductUrl(url: URL): string {
  try {
    return withAffiliateTag(url.toString());
  } catch {
    return url.toString();
  }
}

export type DraftRequest = {
  title: string;
  slug: string | null;
  excerpt: string;
  bodyMd: string;
  tags: string[];
  coverImageUrl: string | null;
  productLinks: { url: string; label: string }[];
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Validates the JSON body. Structural checks only; editorial rules are reported back as `problems`. */
export function parseDraftRequest(body: unknown): { ok: true; value: DraftRequest } | { ok: false; errors: string[] } {
  const e: string[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, errors: ["Body must be a JSON object."] };
  const b = body as Record<string, unknown>;
  const allowed = new Set(["title", "slug", "excerpt", "body", "tags", "coverImageUrl", "productLinks"]);
  for (const k of Object.keys(b)) if (!allowed.has(k)) e.push(`Unknown field: ${k}.`);

  const title = str(b.title);
  if (title.length < 3 || title.length > 110) e.push("title is required (3–110 characters).");
  let slug: string | null = null;
  if (b.slug !== undefined && b.slug !== null && b.slug !== "") {
    if (typeof b.slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.slug) || b.slug.length > 80) e.push("slug must be lowercase words joined by hyphens (max 80).");
    else slug = b.slug;
  }
  const excerpt = typeof b.excerpt === "string" ? b.excerpt.trim() : "";
  if (b.excerpt !== undefined && typeof b.excerpt !== "string") e.push("excerpt must be a string.");
  if (excerpt.length > 170) e.push("excerpt must be at most 170 characters.");
  const bodyMd = typeof b.body === "string" ? b.body.replace(/\r\n/g, "\n").trim() : "";
  if (!bodyMd) e.push("body (Markdown) is required.");
  if (bodyMd.length > 100_000) e.push("body must be at most 100000 characters.");

  let tags: string[] = [];
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags) || b.tags.length > MAX_TAGS || b.tags.some((t) => typeof t !== "string" || !t.trim() || t.length > 40)) e.push(`tags must be up to ${MAX_TAGS} non-empty strings (max 40 characters each).`);
    else tags = [...new Set((b.tags as string[]).map((t) => t.trim().toLowerCase()))];
  }

  let coverImageUrl: string | null = null;
  if (b.coverImageUrl !== undefined && b.coverImageUrl !== null && b.coverImageUrl !== "") {
    const u = httpsUrl(b.coverImageUrl);
    if (!u) e.push("coverImageUrl must be an https URL.");
    else coverImageUrl = u.toString();
  }

  const productLinks: { url: string; label: string }[] = [];
  if (b.productLinks !== undefined) {
    if (!Array.isArray(b.productLinks) || b.productLinks.length > MAX_PRODUCT_LINKS) e.push(`productLinks must be an array of up to ${MAX_PRODUCT_LINKS} items.`);
    else
      b.productLinks.forEach((raw, i) => {
        const l = (raw ?? {}) as Record<string, unknown>;
        const u = httpsUrl(l.url);
        const label = str(l.label);
        if (!u) e.push(`productLinks[${i}].url must be an https URL.`);
        if (!label || label.length > 120) e.push(`productLinks[${i}].label is required (max 120 characters).`);
        if (u && label) productLinks.push({ url: tagProductUrl(u), label });
      });
  }

  return e.length ? { ok: false, errors: e } : { ok: true, value: { title, slug, excerpt, bodyMd, tags, coverImageUrl, productLinks } };
}

/** First free slug: base, base-2, base-3, ... */
export async function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = (slugify(base) || "post").slice(0, 72).replace(/-+$/g, "");
  if (!(await taken(root))) return root;
  for (let i = 2; i < 1000; i++) {
    const s = `${root}-${i}`;
    if (!(await taken(s))) return s;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Row values for the insert. Status is always "draft" here; there is no way to pass another. */
export function draftRow(d: DraftRequest, slug: string) {
  const targetKeyword = d.tags[0] ?? d.title;
  return {
    slug,
    title: d.title,
    description: d.excerpt,
    targetKeyword,
    topicKey: topicKey(targetKeyword),
    kind: "buying_guide",
    bodyMd: d.bodyMd,
    affiliateItemIds: [...new Set([...d.bodyMd.matchAll(/\[\[pick:([^\]\s]+)\]\]/g)].map((m) => m[1]))],
    tags: d.tags,
    coverImageUrl: d.coverImageUrl,
    productLinks: d.productLinks,
    status: "draft" as const,
    source: "api",
    aiModel: null,
  };
}

export function reviewUrl(id: string, env: Env = process.env): string {
  return `${(env.APP_URL?.trim() || "https://spockshop.com").replace(/\/+$/, "")}/admin/blog/${id}`;
}
