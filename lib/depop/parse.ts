import { productConditions, type ProductCondition } from "@/lib/types";

export type DepopListing = {
  title: string;
  description: string;
  priceCents: number | null;
  currency: string | null;
  size: string | null;
  condition: ProductCondition;
  conditionLabel: string | null;
  brand: string | null;
  photos: string[];
  /** True when the page says the listing already sold (skip it on import). */
  sold: boolean;
};

const SOLD_AVAIL = /(SoldOut|OutOfStock|Discontinued|out[ _-]?of[ _-]?stock|^oos$|^sold$)/i;
/** Sold markers for THIS listing only: its JSON-LD Product offer availability and its meta tags. */
export function soldFromHtml(html: string): boolean {
  for (const k of ["product:availability", "og:availability", "product:sold"]) {
    const v = meta(html, k);
    if (v && (SOLD_AVAIL.test(v) || /^true$/i.test(v))) return true;
  }
  for (const s of scripts(html, /type\s*=\s*["']application\/ld\+json["']/i)) {
    const data = tryJson(s);
    const nodes = Array.isArray(data) ? data : isObj(data) && Array.isArray(data["@graph"]) ? (data["@graph"] as unknown[]) : [data];
    for (const n of nodes) {
      if (!isObj(n)) continue;
      const type = n["@type"];
      if (!(type === "Product" || (Array.isArray(type) && type.includes("Product")))) continue;
      const offers = Array.isArray(n.offers) ? n.offers : [n.offers];
      const avail = offers.map((o) => (isObj(o) ? str(o.availability) : null)).filter((x): x is string => !!x);
      return avail.length > 0 && avail.every((v) => SOLD_AVAIL.test(v.replace(/^https?:\/\/schema\.org\//i, "")));
    }
  }
  return false;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function scripts(html: string, test: RegExp): string[] {
  const out: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(html)); ) if (test.test(m[1])) out.push(m[2]);
  return out;
}

function tryJson(s: string): unknown {
  try { return JSON.parse(s.trim()); } catch { return null; }
}

function meta(html: string, key: string): string | null {
  const re = /<meta\b[^>]*>/gi;
  for (let m; (m = re.exec(html)); ) {
    const tag = m[0];
    const k = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (k?.toLowerCase() === key) {
      const c = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
      if (c != null) return decodeEntities(c).trim() || null;
    }
  }
  return null;
}

/** Map Depop / schema.org condition wording to the shop's conditions. */
export function mapCondition(label: string | null): ProductCondition {
  const l = (label ?? "").toLowerCase().replace(/[_-]+/g, " ");
  if (/brand new|^new|newcondition|new with tags|deadstock/.test(l)) return "New";
  if (/like new|refurbished/.test(l)) return "Like New";
  if (/excellent/.test(l)) return "Excellent";
  if (/fair|damaged|worn/.test(l)) return l.includes("damaged") ? "For Parts/Repair" : "Fair";
  if (/good|used/.test(l)) return "Good";
  return "Good";
}

export function priceToCents(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100);
}

function images(v: unknown): string[] {
  const out: string[] = [];
  const push = (x: unknown) => {
    if (typeof x === "string") out.push(x);
    else if (isObj(x)) {
      const u = str(x.url) ?? str(x.contentUrl) ?? str(x.src);
      if (u) out.push(u);
      // __NEXT_DATA__ pictures often carry several sizes; take the largest-looking one.
      else for (const val of Object.values(x)) if (typeof val === "string" && /^https:\/\//.test(val)) { out.push(val); break; }
    }
  };
  if (Array.isArray(v)) v.forEach(push); else push(v);
  return out;
}

function fromJsonLd(html: string): Partial<DepopListing> & { conditionRaw?: string | null } {
  for (const s of scripts(html, /type\s*=\s*["']application\/ld\+json["']/i)) {
    const data = tryJson(s);
    const nodes = Array.isArray(data) ? data : isObj(data) && Array.isArray(data["@graph"]) ? (data["@graph"] as unknown[]) : [data];
    for (const n of nodes) {
      if (!isObj(n)) continue;
      const type = n["@type"];
      if (!(type === "Product" || (Array.isArray(type) && type.includes("Product")))) continue;
      const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
      const o = isObj(offer) ? offer : {};
      const brand = isObj(n.brand) ? str(n.brand.name) : str(n.brand);
      return {
        title: str(n.name) ?? undefined,
        description: str(n.description) ?? undefined,
        priceCents: priceToCents(o.price) ?? undefined,
        currency: str(o.priceCurrency) ?? undefined,
        size: str(n.size) ?? undefined,
        brand: brand ?? undefined,
        conditionRaw: str(n.itemCondition) ?? str(o.itemCondition),
        photos: images(n.image),
      };
    }
  }
  return {};
}

/** Find the most product-like object inside __NEXT_DATA__ (structure varies between Depop releases). */
function findProduct(root: unknown): Obj | null {
  let best: Obj | null = null;
  let bestScore = 0;
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 14 || !v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
    const o = v as Obj;
    let score = 0;
    if ("description" in o) score++;
    if ("pictures" in o || "pictureIds" in o || "images" in o) score += 2;
    if ("price" in o || "pricing" in o) score++;
    if ("condition" in o) score++;
    if ("sizes" in o || "size" in o) score++;
    if (score > bestScore) { best = o; bestScore = score; }
    Object.values(o).forEach((x) => walk(x, depth + 1));
  };
  walk(root, 0);
  return bestScore >= 3 ? best : null;
}

function fromNextData(html: string): Partial<DepopListing> & { conditionRaw?: string | null } {
  const s = scripts(html, /id\s*=\s*["']__NEXT_DATA__["']/i)[0];
  if (!s) return {};
  const p = findProduct(tryJson(s));
  if (!p) return {};
  const pricing = isObj(p.pricing) ? p.pricing : isObj(p.price) ? p.price : {};
  const priceRaw = isObj(p.price) ? (pricing.priceAmount ?? pricing.amount ?? pricing.price) : (p.price ?? (isObj(pricing.originalPrice) ? pricing.originalPrice.priceAmount : pricing.priceAmount));
  const sizes = Array.isArray(p.sizes) ? p.sizes : p.size != null ? [p.size] : [];
  const size = sizes.map((x) => (isObj(x) ? str(x.name) ?? str(x.label) : str(x))).filter(Boolean).join(", ") || null;
  const cond = isObj(p.condition) ? str(p.condition.name) ?? str(p.condition.id) : str(p.condition);
  const brand = isObj(p.brand) ? str(p.brand.name) : str(p.brand) ?? str(p.brandName);
  const pics = Array.isArray(p.pictures) ? p.pictures.flatMap((x) => (Array.isArray(x) ? images(x.at(-1)) : images(x))) : images(p.images);
  return {
    title: str(p.title) ?? str(p.name) ?? undefined,
    description: str(p.description) ?? undefined,
    priceCents: priceToCents(priceRaw) ?? undefined,
    currency: str(pricing.currencyName) ?? str(pricing.currency) ?? str(p.currency) ?? undefined,
    size: size ?? undefined,
    brand: brand ?? undefined,
    conditionRaw: cond,
    photos: pics,
  };
}

function fromHtml(html: string): Partial<DepopListing> {
  const title = meta(html, "og:title") ?? str(decodeEntities(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ""));
  const ogImages: string[] = [];
  const re = /<meta\b[^>]*(?:property|name)\s*=\s*["']og:image["'][^>]*>/gi;
  for (let m; (m = re.exec(html)); ) { const c = /content\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1]; if (c) ogImages.push(decodeEntities(c)); }
  return {
    title: title?.replace(/\s*\|\s*Depop\s*$/i, "") ?? undefined,
    description: meta(html, "og:description") ?? meta(html, "description") ?? undefined,
    priceCents: priceToCents(meta(html, "product:price:amount") ?? meta(html, "og:price:amount")) ?? undefined,
    currency: meta(html, "product:price:currency") ?? undefined,
    photos: ogImages,
  };
}

export class DepopParseError extends Error {
  readonly userFacing = true;
}

/** Parse a Depop product page: JSON-LD first, then __NEXT_DATA__, then meta-tag fallbacks. */
export function parseDepopListing(html: string): DepopListing {
  const a = fromJsonLd(html);
  const b = fromNextData(html);
  const c = fromHtml(html);
  const pick = <K extends keyof DepopListing>(k: K) => (a[k] ?? b[k] ?? c[k]) as DepopListing[K] | undefined;
  const title = pick("title")?.slice(0, 160);
  if (!title || title.length < 2) throw new DepopParseError("Couldn't find the listing title on that page.");
  const conditionRaw = a.conditionRaw ?? b.conditionRaw ?? null;
  const photos = [...new Set([...(b.photos ?? []), ...(a.photos ?? []), ...(c.photos ?? [])].map(decodeEntities))];
  return {
    title,
    description: (pick("description") ?? "").slice(0, 8000),
    priceCents: pick("priceCents") ?? null,
    currency: pick("currency") ?? null,
    size: pick("size") ?? null,
    condition: mapCondition(conditionRaw),
    conditionLabel: conditionRaw ? conditionRaw.replace(/^https?:\/\/schema\.org\//i, "") : null,
    brand: pick("brand") ?? null,
    photos,
    sold: soldFromHtml(html),
  };
}

export { productConditions };
