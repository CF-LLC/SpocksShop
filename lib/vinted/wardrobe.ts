import { mapCondition, priceToCents, type DepopListing } from "@/lib/depop/parse";
import { MAX_PHOTOS } from "@/lib/media";
import { isAllowedVintedPhotoUrl, normalizeVintedUrl } from "./url";

/**
 * Items embedded in Cooper's own public Vinted member page ("initialWardrobeItems"): the first page of
 * listings (title, price, brand, size, condition, photos, closed/sold) without opening each item page
 * (which Vinted's bot check refuses from the server). Later pages come from parseWardrobePage.
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

/** Either spelling: the member page uses camelCase, Vinted's wardrobe JSON (later pages) snake_case. */
const pick = (o: Obj, camel: string, snake: string): unknown => (camel in o ? o[camel] : o[snake]);

/** One wardrobe entry (page or JSON) -> item, plus the member id it belongs to. */
function toItem(it: unknown): { item: WardrobeItem; owner: string | null } | null {
  if (!isObj(it)) return null;
  const id = str(it.id);
  const norm = id ? normalizeVintedUrl(`https://www.vinted.com/items/${id}`) : null;
  if (!norm?.ok) return null;
  const owner = isObj(it.user) ? str(it.user.id) : str(it.user_id);
  const rawBox = pick(it, "itemBox", "item_box");
  const box = isObj(rawBox) ? rawBox : {};
  const label = str(pick(box, "accessibilityLabel", "accessibility_label")) ?? "";
  const second = (str(pick(box, "secondLine", "second_line")) ?? "").split("·").map((s) => s.trim());

  const conditionLabel = labelPart(label, "condition") ?? (second.length > 1 ? second[second.length - 1] : null) ?? str(it.status);
  const size = labelPart(label, "size") ?? (second.length > 1 ? second[0] : null) ?? str(it.size);
  const price = isObj(it.price) ? it.price : {};
  const photos = (Array.isArray(it.photos) ? it.photos : [])
    .map((p) => (isObj(p) ? str(p.url) : null))
    .filter((u): u is string => !!u && isAllowedVintedPhotoUrl(u))
    .slice(0, MAX_PHOTOS);
  const thumb = str(pick(it, "thumbnailUrl", "thumbnail_url"));
  const title = (str(it.title) ?? "").slice(0, 200);
  if (!title) return null;
  // Without a brand, Vinted's first line repeats the title: that isn't a brand.
  const firstLine = str(pick(box, "firstLine", "first_line"));
  const brand = labelPart(label, "brand") ?? (firstLine && firstLine !== title ? firstLine : null) ?? str(it.brand);
  return {
    owner,
    item: {
      url: norm.url,
      listing: {
        title,
        description: "",
        priceCents: priceToCents(price.amount),
        currency: str(pick(price, "currencyCode", "currency_code")),
        size: size ? size.slice(0, 80) : null,
        condition: mapCondition(conditionLabel),
        conditionLabel,
        brand: brand ? brand.slice(0, 100) : null,
        photos: photos.length ? photos : thumb && isAllowedVintedPhotoUrl(thumb) ? [thumb] : [],
        sold: pick(it, "isClosed", "is_closed") === true || str(pick(it, "itemClosingAction", "item_closing_action")) === "sold",
      },
    },
  };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseWardrobe(html: string): Wardrobe {
  const data = extractJson(html, "initialWardrobeItems") ?? extractJson(unescapeFlight(html), "initialWardrobeItems");
  if (!isObj(data) || !Array.isArray(data.items)) return { items: [], total: null, complete: false, ownerId: null };
  const pag = isObj(data.pagination) ? data.pagination : {};
  const total = num(pag.totalEntries);
  const items: WardrobeItem[] = [];
  let ownerId: string | null = null;
  for (const raw of data.items) {
    const r = toItem(raw);
    if (!r) continue;
    ownerId ??= r.owner;
    items.push(r.item);
  }
  const pages = num(pag.totalPages);
  return { items, total, complete: pages === 1 && total === items.length, ownerId };
}

/** One page of Vinted's wardrobe JSON (what the member page itself loads for "more items"). */
export type WardrobePage = { items: WardrobeItem[]; owners: string[]; total: number | null; totalPages: number | null; rawCount: number };

export function parseWardrobePage(json: string): WardrobePage | null {
  let d: unknown;
  try { d = JSON.parse(json); } catch { return null; }
  if (!isObj(d) || !Array.isArray(d.items)) return null;
  const pag = isObj(d.pagination) ? d.pagination : {};
  const items: WardrobeItem[] = [];
  const owners = new Set<string>();
  for (const raw of d.items) {
    const r = toItem(raw);
    if (!r) continue;
    owners.add(r.owner ?? "?");
    items.push(r.item);
  }
  return { items, owners: [...owners], total: num(pick(pag, "totalEntries", "total_entries")), totalPages: num(pick(pag, "totalPages", "total_pages")), rawCount: d.items.length };
}
