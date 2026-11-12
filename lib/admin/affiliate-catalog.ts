import { parseAffiliateBatch } from "@/lib/affiliate/import";
import { asinFromUrl, buildAffiliateUrlFromAsin, isValidAsin, withAffiliateTag } from "@/lib/commerce/affiliate";

export type AffiliateListFilter = {
  q?: string;
  /** "all", "none" (no category), or a category slug. */
  category?: string;
  status?: "all" | "live" | "hidden";
};

type Filterable = {
  title: string;
  fullTitle?: string | null;
  blurb?: string | null;
  why?: string | null;
  asin?: string | null;
  category?: string | null;
  active: boolean;
};

/** Search, category, and active/hidden filters for the merchandising catalog. */
export function filterAffiliateItems<T extends Filterable>(items: readonly T[], filter: AffiliateListFilter): T[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  const category = filter.category && filter.category !== "all" ? filter.category : "";
  const status = filter.status ?? "all";
  return items.filter((item) => {
    if (status === "live" && !item.active) return false;
    if (status === "hidden" && item.active) return false;
    if (category === "none" && item.category) return false;
    if (category && category !== "none" && item.category !== category) return false;
    if (!q) return true;
    const hay = [item.title, item.fullTitle, item.blurb, item.why, item.asin].filter(Boolean).join("\n").toLowerCase();
    return hay.includes(q);
  });
}

export function catalogCounts<T extends { active: boolean }>(items: readonly T[]) {
  const live = items.filter((item) => item.active).length;
  return { live, hidden: items.length - live, total: items.length };
}

/** What's missing before a pick is ready to convert: a photo, a blurb, or both. */
export function missingCopy(item: { blurb?: string | null; imageUrl?: string | null }): ("blurb" | "image")[] {
  const missing: ("blurb" | "image")[] = [];
  if (!item.blurb?.trim()) missing.push("blurb");
  if (!item.imageUrl?.trim()) missing.push("image");
  return missing;
}

export function missingCopyLabel(missing: readonly ("blurb" | "image")[]): string | null {
  if (missing.includes("blurb") && missing.includes("image")) return "Needs a blurb and an image";
  if (missing.includes("blurb")) return "Needs a blurb";
  if (missing.includes("image")) return "Needs an image";
  return null;
}

/** Move `from` to `to`. Returns the same array when the move is a no-op. */
export function moveItem<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function moveId(ids: readonly string[], id: string, direction: "up" | "down"): readonly string[] {
  const index = ids.indexOf(id);
  if (index < 0) return ids;
  return moveItem(ids, index, direction === "up" ? index - 1 : index + 1);
}

export function moveIdTo(ids: readonly string[], id: string, toIndex: number): readonly string[] {
  return moveItem(ids, ids.indexOf(id), toIndex);
}

/**
 * Persist a full-catalog order. The posted ids must be exactly the current picks
 * (no drops, no duplicates) so a filtered view cannot scramble the rest.
 */
export function planSortOrder(existingIds: readonly string[], requestedIds: readonly string[]): { ok: true; rows: { id: string; sortOrder: number }[] } | { ok: false; error: string } {
  if (!requestedIds.length) return { ok: false, error: "Nothing to reorder." };
  if (requestedIds.length !== existingIds.length) return { ok: false, error: "Reorder must include every pick. Clear filters and try again." };
  const have = new Set(existingIds);
  const seen = new Set<string>();
  for (const id of requestedIds) {
    if (!have.has(id) || seen.has(id)) return { ok: false, error: "That order doesn't match the catalog." };
    seen.add(id);
  }
  return { ok: true, rows: requestedIds.map((id, sortOrder) => ({ id, sortOrder })) };
}

/** Paste an Amazon URL or a bare ASIN. Returns a tagged URL plus the ASIN when we can see one. */
export function parseAmazonPaste(raw: string): { asin: string | null; amazonUrl: string } | null {
  const text = raw.trim();
  if (!text) return null;
  if (isValidAsin(text) && !text.includes("/") && !text.includes(".")) {
    const asin = text.toUpperCase();
    return { asin, amazonUrl: buildAffiliateUrlFromAsin(asin) };
  }
  const candidate = /^https?:\/\//i.test(text) ? text : text.includes(".") ? `https://${text}` : "";
  if (!candidate) return null;
  try {
    const amazonUrl = withAffiliateTag(candidate);
    return { asin: asinFromUrl(amazonUrl), amazonUrl };
  } catch {
    return null;
  }
}

export type ImportPreviewCard = {
  title: string;
  imageUrl: string | null;
  blurb: string | null;
  asin: string | null;
  category?: string;
};

/** Cards for the import preview. Price notes stay out of this shape so the UI cannot render them. */
export function importPreviewCards(input: unknown): { ok: true; cards: ImportPreviewCard[] } | { ok: false; errors: string[] } {
  const parsed = parseAffiliateBatch(input);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    cards: parsed.rows.map((row) => ({
      title: row.title,
      imageUrl: row.imageUrl,
      blurb: row.blurb,
      asin: row.asin,
      ...(row.category ? { category: row.category } : {}),
    })),
  };
}
