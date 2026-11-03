/**
 * /shop Closet filters. Closet rows have no category or size columns filled in, so both are derived from the
 * listing title/description (keyword rules). Pure functions: URL params in, filtered list out (server-side).
 */
export type FilterItem = { key: string; title: string; description: string; brand?: string; priceCents: number; listedAt?: string };

export const CATEGORIES: { slug: string; label: string; re: RegExp }[] = [
  { slug: "lego", label: "LEGO", re: /\blego\b/ },
  { slug: "plush", label: "Plush & toys", re: /\b(plush\w*|squishmallows?|stuffed|toy|toys|doll|figure|figurine|funko|teddy|bear)\b/ },
  { slug: "shoes", label: "Shoes", re: /\b(shoes?|boots?|sneakers?|sandals?|heels|slippers?|loafers?|cleats|crocs|fins|flip flops?)\b/ },
  { slug: "bags", label: "Bags", re: /\b(bag|backpack|purse|tote|duffel|wallet|handbag|crossbody|clutch)\b/ },
  {
    slug: "clothing", label: "Clothing",
    re: /\b(t-?shirt|tee|shirt|sweatshirt|hoodie|jacket|coat|dress|top|blouse|jeans|shorts|leggings|bodysuit|cami|bra|bralette|pants|scrubs?|bikini|sweater|skirt|vest|cardigan|romper|jumpsuit|tank|crewneck|fleece|corset|quarter zip|joggers|overalls|swimsuit|hat|beanie|socks|pajamas?|onesie|costume|scarf|poncho|snapback|cap)\b/,
  },
  { slug: "glassware", label: "Mugs & glassware", re: /\b(mugs?|cups?|goblets?|glass(es|ware)?|tumblers?|plates?|bottle|pitcher|bowls?)\b/ },
  { slug: "games", label: "Games & cards", re: /\b(cards?|games?|uno|poker|puzzle|tabletop|xbox|playstation|nintendo|switch|wii)\b/ },
  { slug: "phone", label: "Phone cases", re: /\b(phone case|iphone|airpods?|otterbox)\b/ },
];
export const OTHER = { slug: "other", label: "Other finds" };

export function categoryOf(i: Pick<FilterItem, "title">): string {
  const t = i.title.toLowerCase().replace(/&amp;/g, "&");
  return CATEGORIES.find((c) => c.re.test(t))?.slug ?? OTHER.slug;
}

export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
const SIZE_MAP: Record<string, string> = { XXS: "XS", XS: "XS", S: "S", SMALL: "S", M: "M", MEDIUM: "M", L: "L", LARGE: "L", XL: "XL", XXL: "2XL", "2XL": "2XL", XXXL: "3XL", "3XL": "3XL" };
/** Letter sizes only ("Size: M / US 8-10", "size 2XL"); numeric/kids sizes are too varied to chip. */
export function sizeOf(i: Pick<FilterItem, "title" | "description">): string | null {
  const m = `${i.title} ${i.description}`.match(/\bsize[:\s]*\(?\s*(XXXL|XXL|XXS|3XL|2XL|XL|XS|S|M|L|small|medium|large)\b/i);
  return m ? SIZE_MAP[m[1].toUpperCase()] ?? null : null;
}

export const PRICE_BUCKETS = [
  { slug: "under-10", label: "Under $10", min: 0, max: 999 },
  { slug: "10-25", label: "$10–25", min: 1000, max: 2499 },
  { slug: "25-50", label: "$25–50", min: 2500, max: 4999 },
  { slug: "50-up", label: "$50+", min: 5000, max: Infinity },
] as const;

export const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
] as const;
export type Sort = (typeof SORTS)[number]["key"];

export type ClosetQuery = { q: string; cat: string | null; size: string | null; price: string | null; sort: Sort; page: number };
type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseClosetQuery(p: Raw): ClosetQuery {
  const cat = one(p.cat);
  const size = one(p.size).toUpperCase();
  const price = one(p.price);
  const sort = one(p.sort);
  const page = Math.min(20, Math.max(1, Number.parseInt(one(p.page), 10) || 1));
  return {
    q: one(p.q).trim().slice(0, 80),
    cat: [...CATEGORIES, OTHER].some((c) => c.slug === cat) ? cat : null,
    size: (SIZE_ORDER as readonly string[]).includes(size) ? size : null,
    price: PRICE_BUCKETS.some((b) => b.slug === price) ? price : null,
    sort: SORTS.some((s) => s.key === sort) ? (sort as Sort) : "newest",
    page,
  };
}

/** Shareable URL for a query, with one field overridden (null clears it). Page resets unless set. */
export function closetHref(q: ClosetQuery, patch: Partial<Record<keyof ClosetQuery, string | number | null>> = {}): string {
  const merged: Record<string, string | number | null> = { q: q.q || null, cat: q.cat, size: q.size, price: q.price, sort: q.sort === "newest" ? null : q.sort, page: null, ...patch };
  if (merged.page === 1) merged.page = null;
  const sp = new URLSearchParams();
  for (const k of ["q", "cat", "size", "price", "sort", "page"]) if (merged[k] != null && merged[k] !== "") sp.set(k, String(merged[k]));
  const s = sp.toString();
  return s ? `/shop?${s}` : "/shop";
}

export function applyClosetQuery<T extends FilterItem>(items: T[], q: ClosetQuery): T[] {
  const needle = q.q.toLowerCase();
  const bucket = PRICE_BUCKETS.find((b) => b.slug === q.price);
  const out = items.filter((i) =>
    (!needle || [i.title, i.description, i.brand ?? ""].join(" ").toLowerCase().includes(needle)) &&
    (!q.cat || categoryOf(i) === q.cat) &&
    (!q.size || sizeOf(i) === q.size) &&
    (!bucket || (i.priceCents >= bucket.min && i.priceCents <= bucket.max)));
  const stable = out.map((v, n) => ({ v, n }));
  stable.sort((a, b) =>
    q.sort === "price-asc" ? a.v.priceCents - b.v.priceCents || a.n - b.n
    : q.sort === "price-desc" ? b.v.priceCents - a.v.priceCents || a.n - b.n
    : (b.v.listedAt ?? "").localeCompare(a.v.listedAt ?? "") || a.n - b.n);
  return stable.map((s) => s.v);
}

/** Facet options with counts from the full list; options with no items are left out (hidden filters). */
export function facets(items: FilterItem[]) {
  const count = <K extends string>(keys: (K | null)[]) => keys.reduce((m, k) => (k ? m.set(k, (m.get(k) ?? 0) + 1) : m), new Map<K, number>());
  const cats = count(items.map(categoryOf));
  const sizes = count(items.map(sizeOf));
  const prices = count(items.map((i) => PRICE_BUCKETS.find((b) => i.priceCents >= b.min && i.priceCents <= b.max)?.slug ?? null));
  return {
    categories: [...CATEGORIES, OTHER].filter((c) => cats.get(c.slug)).map((c) => ({ slug: c.slug, label: c.label, n: cats.get(c.slug)! })),
    sizes: SIZE_ORDER.filter((s) => sizes.get(s)).map((s) => ({ slug: s, label: s, n: sizes.get(s)! })),
    prices: PRICE_BUCKETS.filter((b) => prices.get(b.slug)).map((b) => ({ slug: b.slug, label: b.label, n: prices.get(b.slug)! })),
  };
}

/** Items between feature cards: 12 = full rows at 2, 3 and 4 grid columns. */
export const FEATURE_EVERY = 12;
export const PAGE_SIZE = 48;

/** Interleave: after every `every` items insert the next feature (alternating list supplied by caller). */
export function interleave<T, F>(items: T[], features: F[], every = FEATURE_EVERY, offset = 0): ({ kind: "item"; item: T } | { kind: "feature"; feature: F })[] {
  const out: ({ kind: "item"; item: T } | { kind: "feature"; feature: F })[] = [];
  items.forEach((item, n) => {
    out.push({ kind: "item", item });
    const i = n + 1;
    if (features.length && i % every === 0 && i < items.length) out.push({ kind: "feature", feature: features[(offset + i / every - 1) % features.length] });
  });
  return out;
}

/** Alternate Amazon / Drop features; falls back to whichever exists. */
export function alternate<A, B>(a: A[], b: B[]): (A | B)[] {
  const out: (A | B)[] = [];
  for (let n = 0; n < Math.max(a.length, b.length); n++) {
    if (n < a.length) out.push(a[n]);
    if (n < b.length) out.push(b[n]);
  }
  return out;
}
