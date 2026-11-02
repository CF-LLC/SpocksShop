import { mapCondition, priceToCents, type DepopListing } from "@/lib/depop/parse";
import { MAX_PHOTOS } from "@/lib/media";
import { isAllowedVintedPhotoUrl, normalizeVintedUrl } from "./url";

/**
 * Items embedded in Cooper's own public Vinted member page ("initialWardrobeItems"), so one page read
 * gives every listing (title, price, brand, size, condition, photos, closed/sold) without opening
 * each item page (which Vinted's bot check refuses from the server).
 */
export type WardrobeItem = { url: string; listing: DepopListing };
export type Wardrobe = { items: WardrobeItem[]; total: number | null; complete: boolean; ownerId: string | null };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);

/** The page data sits inside a JS string (Next.js flight data): undo one level of escaping. */
const unescapeFlight = (s: string) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");

function extractJson(src: string, key: string): unknown {
  const i = src.indexOf(`"${key}":`);
  if (i < 0) return null;
  const start = i + key.length + 3;
  if (src[start] !== "{") return null;
  let depth = 0, inStr = false;
  for (let j = start; j < src.length && j < start + 5_000_000; j++) {
    const c = src[j];
    if (inStr) { if (c === "\\") j++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { try { return JSON.parse(src.slice(start, j + 1)); } catch { return null; } }
  }
  return null;
}

/** "Maze collection pants, brand: Maze, condition: Very good, size: M / US 8-10, $2.44, …" */
function labelPart(label: string, key: string): string | null {
  const m = new RegExp(`(?:^|, )${key}: ([^,]{1,80})`, "i").exec(label);
  return m ? m[1].trim() : null;
}

export function parseWardrobe(html: string): Wardrobe {
  const data = extractJson(html, "initialWardrobeItems") ?? extractJson(unescapeFlight(html), "initialWardrobeItems");
  if (!isObj(data) || !Array.isArray(data.items)) return { items: [], total: null, complete: false, ownerId: null };
  const pag = isObj(data.pagination) ? data.pagination : {};
  const total = typeof pag.totalEntries === "number" ? pag.totalEntries : null;
  const items: WardrobeItem[] = [];
  let ownerId: string | null = null;
  for (const it of data.items) {
    if (!isObj(it)) continue;
    const id = str(it.id);
    const norm = id ? normalizeVintedUrl(`https://www.vinted.com/items/${id}`) : null;
    if (!norm?.ok) continue;
    if (isObj(it.user)) ownerId ??= str(it.user.id);
    const box = isObj(it.itemBox) ? it.itemBox : {};
    const label = str(box.accessibilityLabel) ?? "";
    const second = (str(box.secondLine) ?? "").split("·").map((s) => s.trim());
    const brand = labelPart(label, "brand") ?? str(box.firstLine);
    const conditionLabel = labelPart(label, "condition") ?? (second.length > 1 ? second[second.length - 1] : null);
    const size = labelPart(label, "size") ?? (second.length > 1 ? second[0] : null);
    const price = isObj(it.price) ? it.price : {};
    const photos = (Array.isArray(it.photos) ? it.photos : [])
      .map((p) => (isObj(p) ? str(p.url) : null))
      .filter((u): u is string => !!u && isAllowedVintedPhotoUrl(u))
      .slice(0, MAX_PHOTOS);
    const thumb = str(it.thumbnailUrl);
    const title = (str(it.title) ?? "").slice(0, 200);
    if (!title) continue;
    items.push({
      url: norm.url,
      listing: {
        title,
        description: "",
        priceCents: priceToCents(price.amount),
        currency: str(price.currencyCode),
        size: size ? size.slice(0, 80) : null,
        condition: mapCondition(conditionLabel),
        conditionLabel,
        brand: brand ? brand.slice(0, 100) : null,
        photos: photos.length ? photos : thumb && isAllowedVintedPhotoUrl(thumb) ? [thumb] : [],
        sold: it.isClosed === true || str(it.itemClosingAction) === "sold",
      },
    });
  }
  const pages = typeof pag.totalPages === "number" ? pag.totalPages : null;
  return { items, total, complete: pages === 1 && total === items.length, ownerId };
}
