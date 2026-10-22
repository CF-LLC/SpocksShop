/** First-party event names we count. Keep in sync with the CHECK in drizzle/0011. */
export const EVENT_NAMES = ["product_view", "amazon_click", "checkout_start"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const EVENT_LABELS: Record<EventName, string> = {
  product_view: "Product views",
  amazon_click: "Amazon pick clicks",
  checkout_start: "Checkout starts",
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

export function parseEvent(body: unknown): { name: EventName; path: string | null; ref: string | null } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!EVENT_NAMES.includes(b.name as EventName)) return null;
  return { name: b.name as EventName, path: cleanPath(b.path), ref: cleanRef(b.ref) };
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
