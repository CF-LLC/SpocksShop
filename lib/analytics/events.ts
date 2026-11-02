/** First-party event names we count. Keep in sync with the CHECK in drizzle/0025. */
export const EVENT_NAMES = ["page_view", "product_view", "add_to_cart", "checkout_start", "amazon_click"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const EVENT_LABELS: Record<EventName, string> = {
  page_view: "Page views",
  product_view: "Product views",
  add_to_cart: "Add to cart",
  checkout_start: "Checkout starts",
  amazon_click: "Amazon pick clicks",
};

/** Keep only a same-site path (no query string, so nothing personal sneaks in). */
export function cleanPath(v: unknown): string | null {
  if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//")) return null;
  const p = v.split(/[?#]/)[0].slice(0, 200);
  return /^[\w\-./%]*$/.test(p) ? p : null;
}

/** Amazon clicks record the ASIN (or "link"), nothing else. */
export function cleanRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const r = v.trim().slice(0, 40);
  return /^[\w-]+$/.test(r) ? r : null;
}

const TERM_KEYS = ["q", "query", "p", "text", "wd", "search", "k"];

/**
 * Reduce a referrer to its host (external sites only) and, when the referrer URL itself carries a
 * search query (some engines/sites do; Google normally doesn't), the search term. Never stores the URL.
 */
export function referrerInfo(raw: unknown, ownHosts: string[]): { source: string | null; term: string | null } {
  if (typeof raw !== "string" || !raw) return { source: null, term: null };
  let u: URL;
  try { u = new URL(raw); } catch { return { source: null, term: null }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { source: null, term: null };
  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  if (!host || ownHosts.some((h) => host === h || host.endsWith(`.${h}`))) return { source: null, term: null };
  let term: string | null = null;
  for (const k of TERM_KEYS) {
    const v = u.searchParams.get(k)?.trim();
    if (v) { term = v.toLowerCase().replace(/\s+/g, " ").slice(0, 80); break; }
  }
  // Drop anything that looks like an email/phone so no personal data is kept.
  if (term && (/@/.test(term) || /\d{6,}/.test(term))) term = null;
  return { source: host.slice(0, 80), term };
}

export type ParsedEvent = { name: EventName; path: string | null; ref: string | null; host: string | null; referrer: string | null; test: boolean };

export function parseEvent(body: unknown): ParsedEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!EVENT_NAMES.includes(b.name as EventName)) return null;
  return {
    name: b.name as EventName,
    path: cleanPath(b.path),
    ref: cleanRef(b.ref),
    host: typeof b.host === "string" ? b.host.toLowerCase().slice(0, 100) : null,
    referrer: typeof b.referrer === "string" ? b.referrer.slice(0, 500) : null,
    test: b.test === true,
  };
}

/** Tiny in-memory fixed-window limiter. Keys are hashed in memory only and never stored. */
export function createLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string, now = Date.now()) => {
    const h = hits.get(key);
    if (!h || h.reset <= now) {
      if (hits.size > 5000) hits.clear();
      hits.set(key, { n: 1, reset: now + windowMs });
      return true;
    }
    h.n++;
    return h.n <= limit;
  };
}
