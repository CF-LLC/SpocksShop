/**
 * Permanent redirects for URLs from before the shop was simplified to two
 * sections (Amazon Picks + Closet Picks). Used by next.config.ts.
 * The Community Market (local seller listings) now lives inside Closet Picks.
 */
export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
  has?: { type: "query"; key: string; value?: string }[];
};

export const CLOSET_PICKS_URL = "/shop?tab=closet";

const toCloset = (source: string): LegacyRedirect => ({ source, destination: CLOSET_PICKS_URL, permanent: true });

export const LEGACY_SHOP_REDIRECTS: LegacyRedirect[] = [
  // Old shop tabs.
  { source: "/shop", has: [{ type: "query", key: "tab", value: "community" }], destination: CLOSET_PICKS_URL, permanent: true },
  { source: "/shop", has: [{ type: "query", key: "tab", value: "spocks-closet" }], destination: CLOSET_PICKS_URL, permanent: true },
  { source: "/shop", has: [{ type: "query", key: "tab", value: "closet-picks" }], destination: CLOSET_PICKS_URL, permanent: true },
  // Old section paths (community market / local sellers).
  toCloset("/community"),
  toCloset("/community/:path*"),
  toCloset("/community-market"),
  toCloset("/community-market/:path*"),
  toCloset("/market"),
  toCloset("/local"),
  toCloset("/local/:path*"),
  toCloset("/local-sales"),
  toCloset("/closet"),
  toCloset("/closet-picks"),
  { source: "/amazon", destination: "/shop?tab=amazon", permanent: true },
  { source: "/amazon-picks", destination: "/shop?tab=amazon", permanent: true },
];

/**
 * Pure matcher mirroring Next's redirect rules for the shapes used above,
 * so tests can assert where an old URL ends up.
 */
export function resolveLegacyRedirect(url: string, rules: LegacyRedirect[] = LEGACY_SHOP_REDIRECTS): string | null {
  const u = new URL(url, "https://x.invalid");
  for (const r of rules) {
    const pathOk = r.source.endsWith("/:path*")
      ? u.pathname === r.source.slice(0, -7) || u.pathname.startsWith(r.source.slice(0, -6))
      : u.pathname === r.source;
    if (!pathOk) continue;
    if (r.has && !r.has.every((h) => (h.value === undefined ? u.searchParams.has(h.key) : u.searchParams.get(h.key) === h.value))) continue;
    return r.destination;
  }
  return null;
}
