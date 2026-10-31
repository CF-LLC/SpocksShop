import { DepopParseError, decodeEntities, mapCondition, meta, priceToCents, scripts, soldFromHtml, tryJson, type DepopListing } from "@/lib/depop/parse";
import { isAllowedVintedPhotoUrl } from "./url";

/** Same shape the shared importer uses for every source. */
export type VintedListing = DepopListing;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const text = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function productNode(html: string): Obj | null {
  for (const s of scripts(html, /type\s*=\s*["']application\/ld\+json["']/i)) {
    const d = tryJson(s);
    const nodes = Array.isArray(d) ? d : isObj(d) && Array.isArray(d["@graph"]) ? (d["@graph"] as unknown[]) : [d];
    for (const n of nodes) if (isObj(n) && (n["@type"] === "Product" || (Array.isArray(n["@type"]) && n["@type"].includes("Product")))) return n;
  }
  return null;
}

/** Value of an item detail row: <div itemProp="size"><span>L</span>…  (first text before any button). */
function itemProp(html: string, key: string): string | null {
  const m = new RegExp(`itemProp=["']${key}["'][^>]*>([\\s\\S]{0,600}?)(?:<button|</div>)`, "i").exec(html);
  const v = m ? text(m[1]) : "";
  return v && v.length <= 80 ? v : null;
}

/** Gallery photos for THIS item (data-testid="item-photo-N--img"), in order, deduped. Ignores the "member's items" strip. */
function galleryPhotos(html: string): string[] {
  const byIndex = new Map<number, string>();
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const idx = /data-testid=["']item-photo-(\d+)--img["']/i.exec(tag)?.[1];
    const src = /\ssrc=["']([^"']+)["']/i.exec(tag)?.[1];
    if (idx && src && !byIndex.has(Number(idx))) byIndex.set(Number(idx), decodeEntities(src));
  }
  return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, u]) => u);
}

/** Vinted marks a sold/closed item in its embedded page data; only trust it next to this item's id. */
function closedInPageData(html: string, itemId: string | null): boolean {
  if (!itemId) return false;
  const re = new RegExp(`\\\\?"is_closed\\\\?":true[^{}]{0,400}\\\\?"item_id\\\\?":\\\\?"?${itemId}|\\\\?"item_id\\\\?":\\\\?"?${itemId}\\\\?"?[^{}]{0,400}\\\\?"is_closed\\\\?":true`);
  return re.test(html);
}

export class VintedParseError extends DepopParseError {}

/** Parse a public Vinted item page (JSON-LD Product + item detail rows + gallery). */
export function parseVintedListing(html: string): VintedListing {
  const p = productNode(html);
  const offers = p ? (Array.isArray(p.offers) ? p.offers[0] : p.offers) : null;
  const o = isObj(offers) ? offers : {};
  const ogTitle = meta(html, "og:title")?.replace(/\s*\|\s*Vinted\s*$/i, "") ?? null;
  const title = (str(p?.name) ?? ogTitle ?? "").slice(0, 200);
  if (!title) throw new VintedParseError("Couldn't read that Vinted page (no title found). Add the item by hand.");
  const brand = isObj(p?.brand) ? str((p!.brand as Obj).name) : str(p?.brand);
  const statusLabel = itemProp(html, "status");
  const itemId = /\/items\/(\d+)/.exec(str(o.url) ?? meta(html, "og:url") ?? "")?.[1] ?? null;
  const ldImages = p ? (Array.isArray(p.image) ? p.image : [p.image]).map(str).filter((x): x is string => !!x) : [];
  const photos = [...new Set([...galleryPhotos(html), ...ldImages, ...(meta(html, "og:image") ? [meta(html, "og:image")!] : [])])].filter(isAllowedVintedPhotoUrl);
  return {
    title,
    description: (str(p?.description) ?? "").slice(0, 8000),
    priceCents: priceToCents(o.price),
    currency: str(o.priceCurrency),
    size: itemProp(html, "size"),
    condition: mapCondition(statusLabel ?? str(o.itemCondition)),
    conditionLabel: statusLabel,
    brand: brand ? brand.slice(0, 100) : null,
    photos,
    sold: soldFromHtml(html) || closedInPageData(html, itemId),
  };
}
