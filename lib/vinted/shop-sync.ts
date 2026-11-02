import { MAX_PAGE_BYTES, isBlocked, type Fetcher } from "@/lib/depop/fetch";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { db as Db } from "@/lib/db";
import { productImports, products } from "@/lib/db/schema";
import { OWN_MEMBER, OWN_MEMBER_URL, normalizeMemberUrl, normalizeVintedUrl } from "./url";
import { parseWardrobe, type Wardrobe } from "./wardrobe";

/** Item links on a member page, normalized to /items/<id> and deduped. */
export function memberItemLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:https:\/\/(?:www\.)?vinted\.com)?\/items\/(\d{1,15})(?:-[a-z0-9-]{0,200})?(?=["'?#\\])/gi)) {
    const c = normalizeVintedUrl(`https://www.vinted.com/items/${m[1]}`);
    if (c.ok) out.add(c.url);
  }
  return [...out];
}

export type MemberRead = { ok: true; links: string[]; wardrobe: Wardrobe } | { ok: false; blocked: boolean; message: string };

/**
 * One plain request for Cooper's own public member page (mrspock13 only). If Vinted blocks or
 * challenges it, stop: no retries, no cookies, no bypassing.
 */
export async function readOwnMember(memberUrl: string, fetcher: Fetcher): Promise<MemberRead> {
  const m = normalizeMemberUrl(memberUrl.trim() || OWN_MEMBER_URL);
  if (!m.ok) return { ok: false, blocked: false, message: m.error };
  try {
    const page = await fetcher(m.url, { maxBytes: MAX_PAGE_BYTES * 2, accept: "text/html" });
    const html = new TextDecoder().decode(page.bytes);
    if (!new RegExp(`\\b${OWN_MEMBER}\\b`, "i").test(html)) return { ok: false, blocked: false, message: `That member page isn't ${OWN_MEMBER}'s, so it wasn't synced.` };
    const wardrobe = parseWardrobe(html);
    if (wardrobe.ownerId && wardrobe.ownerId !== m.id) return { ok: false, blocked: false, message: `That member page isn't ${OWN_MEMBER}'s, so it wasn't synced.` };
    const links = wardrobe.items.length ? wardrobe.items.map((i) => i.url) : memberItemLinks(html);
    if (!links.length) return { ok: false, blocked: false, message: "Vinted's member page loaded but listed no items the server could read (it may load them in the browser). Paste your item links instead." };
    return { ok: true, links, wardrobe };
  } catch (e) {
    const blocked = isBlocked(e);
    return { ok: false, blocked, message: blocked ? "Vinted blocked or challenged the shop server. SpockShop doesn't try to get around it: paste item links, or add items by hand." : e instanceof Error && (e as { userFacing?: boolean }).userFacing ? e.message : "Couldn't reach Vinted from the server. Paste item links instead." };
  }
}

export type MissingResult = { id: string; title: string; change: string };

/**
 * Items imported from Vinted that are no longer on Cooper's (complete) member page: sold or removed there.
 * Listed or draft ones are unpublished (archived). Never deleted; sold/archived/trashed items are left alone.
 * Only call this when the page listed every item (wardrobe.complete), otherwise nothing is touched.
 */
export async function unpublishMissing(db: typeof Db, presentUrls: string[]): Promise<MissingResult[]> {
  if (!presentUrls.length) return [];
  const rows = await db
    .select({ id: products.id, title: products.title, status: products.status })
    .from(productImports)
    .innerJoin(products, eq(products.id, productImports.productId))
    .where(and(eq(productImports.source, "vinted"), notInArray(productImports.sourceUrl, presentUrls), inArray(products.status, ["listed", "draft"])));
  if (!rows.length) return [];
  await db.update(products).set({ status: "archived", updatedAt: new Date() }).where(and(inArray(products.id, rows.map((r) => r.id)), eq(products.source, "closet")));
  return rows.map((r) => ({ id: r.id, title: r.title, change: r.status === "listed" ? "no longer on Vinted (sold or removed): taken off the shop (archived)" : "no longer on Vinted: draft archived" }));
}
