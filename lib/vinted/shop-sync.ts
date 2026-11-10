import { MAX_PAGE_BYTES, isBlocked, sleep as realSleep, type Fetcher } from "@/lib/depop/fetch";
import { and, eq, inArray } from "drizzle-orm";
import type { db as Db } from "@/lib/db";
import { productImports, products } from "@/lib/db/schema";
import { OWN_MEMBER, OWN_MEMBER_ID, OWN_MEMBER_URL, normalizeMemberUrl, normalizeVintedUrl } from "./url";
import { parseWardrobe, parseWardrobePage, type Wardrobe, type WardrobeItem } from "./wardrobe";

/** Item links on a member page, normalized to /items/<id> and deduped. */
export function memberItemLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:https:\/\/(?:www\.)?vinted\.com)?\/items\/(\d{1,15})(?:-[a-z0-9-]{0,200})?(?=["'?#\\])/gi)) {
    const c = normalizeVintedUrl(`https://www.vinted.com/items/${m[1]}`);
    if (c.ok) out.add(c.url);
  }
  return [...out];
}

/** Paging report for the admin: complete=false always comes with the reason nothing was unpublished. */
export type Paging = { pagesFetched: number; expected: number | null; seen: number; reason: string | null };
export type MemberRead = { ok: true; links: string[]; wardrobe: Wardrobe; paging: Paging } | { ok: false; blocked: boolean; message: string };

export type PagingOpts = {
  /** Pause between Vinted requests (gentle, sequential). */
  delayMs?: number;
  /** Items per wardrobe page (Vinted's own maximum is 96). */
  perPage?: number;
  /** Never read more pages than this; hitting it means "not confirmed complete". */
  maxPages?: number;
  /** Waits after an HTTP 429 before retrying that same page (one retry per entry), then give up. */
  backoffMs?: number[];
  sleep?: (ms: number) => Promise<void>;
};

const WARDROBE_API = (memberId: string, page: number, perPage: number) =>
  `https://www.vinted.com/api/v2/wardrobe/${memberId}/items?page=${page}&per_page=${perPage}&order=newest_first`;

/** Only Vinted's anonymous visitor token from the member page response (no login, nothing stored). */
function visitorCookie(setCookie: string[] | undefined): string | null {
  for (const c of setCookie ?? []) {
    const m = /^\s*access_token_web=([^;\s]{1,4096})/.exec(c);
    if (m) return `access_token_web=${m[1]}`;
  }
  return null;
}

/**
 * Reads Cooper's own public Vinted member page (mrspock13 only), then, when the page shows only the first
 * items, pages through the full wardrobe the same way the member page does in a browser: sequential, with a
 * pause between pages, a page cap, and a backoff on HTTP 429. No login; a 403 or bot check stops it.
 * `wardrobe.complete` is true only when every page loaded, every item is his, and the item count matches
 * Vinted's own total. Anything less returns what was read (for drafts/sold marking) but complete=false.
 */
export async function readOwnMember(memberUrl: string, fetcher: Fetcher, opts: PagingOpts = {}): Promise<MemberRead> {
  const { delayMs = 2500, perPage = 96, maxPages = 20, backoffMs = [15_000, 45_000], sleep = realSleep } = opts;
  const m = normalizeMemberUrl(memberUrl.trim() || OWN_MEMBER_URL);
  if (!m.ok) return { ok: false, blocked: false, message: m.error };
  let first: Awaited<ReturnType<Fetcher>>;
  try {
    first = await fetcher(m.url, { maxBytes: MAX_PAGE_BYTES * 2, accept: "text/html" });
  } catch (e) {
    const blocked = isBlocked(e);
    return { ok: false, blocked, message: blocked ? "Vinted blocked or challenged the shop server. SpockShop doesn't try to get around it: paste item links, or add items by hand." : e instanceof Error && (e as { userFacing?: boolean }).userFacing ? e.message : "Couldn't reach Vinted from the server. Paste item links instead." };
  }
  const html = new TextDecoder().decode(first.bytes);
  const notOwn = { ok: false as const, blocked: false, message: `That member page isn't ${OWN_MEMBER}'s, so it wasn't synced.` };
  if (!new RegExp(`\\b${OWN_MEMBER}\\b`, "i").test(html)) return notOwn;
  const wardrobe = parseWardrobe(html);
  if (wardrobe.ownerId && wardrobe.ownerId !== m.id) return notOwn;
  if (!wardrobe.items.length) {
    const links = memberItemLinks(html);
    if (!links.length) return { ok: false, blocked: false, message: "Vinted's member page loaded but listed no items the server could read (it may load them in the browser). Paste your item links instead." };
    return { ok: true, links, wardrobe, paging: { pagesFetched: 1, expected: null, seen: links.length, reason: "The member page had no item data, only links." } };
  }

  const byUrl = new Map<string, WardrobeItem>(wardrobe.items.map((i) => [i.url, i]));
  const done = (reason: string | null, pagesFetched: number): MemberRead => {
    const items = [...byUrl.values()];
    const complete = reason === null && wardrobe.total !== null && items.length === wardrobe.total;
    const why = reason ?? (complete ? null : `Read ${items.length} items but Vinted says ${wardrobe.total ?? "?"}.`);
    return { ok: true, links: items.map((i) => i.url), wardrobe: { ...wardrobe, items, complete }, paging: { pagesFetched, expected: wardrobe.total, seen: items.length, reason: why } };
  };
  if (wardrobe.complete) return done(null, 1);
  if (wardrobe.total === null) return done("The member page didn't say how many items there are.", 1);
  // Only his own wardrobe, and only once the page itself proved it is his.
  if (m.id !== OWN_MEMBER_ID || wardrobe.ownerId !== OWN_MEMBER_ID) return done(`Only ${OWN_MEMBER}'s own wardrobe is paged.`, 1);
  const pages = Math.ceil(wardrobe.total / perPage);
  if (pages > maxPages) return done(`Vinted lists ${wardrobe.total} items (${pages} pages), more than the ${maxPages}-page limit.`, 1);
  const cookie = visitorCookie(first.setCookie);
  if (!cookie) return done("Vinted didn't allow loading the rest of the member page.", 1);

  let fetched = 1;
  for (let page = 1; page <= pages; page++) {
    let body: string | null = null;
    for (let attempt = 0; body === null; attempt++) {
      await sleep(delayMs);
      try {
        const r = await fetcher(WARDROBE_API(OWN_MEMBER_ID, page, perPage), { maxBytes: MAX_PAGE_BYTES, accept: "application/json", cookie });
        body = new TextDecoder().decode(r.bytes);
      } catch (e) {
        const status = (e as { httpStatus?: number } | null)?.httpStatus;
        if (status === 429 && attempt < backoffMs.length) { await sleep(backoffMs[attempt]); continue; }
        return done(status === 429 ? `Vinted asked the server to slow down on page ${page}; stopped.` : isBlocked(e) ? `Vinted blocked page ${page}; stopped (nothing bypassed).` : `Page ${page} of your member items didn't load.`, fetched);
      }
    }
    fetched++;
    const p = parseWardrobePage(body);
    if (!p) return done(`Page ${page} of your member items wasn't readable.`, fetched);
    if (p.owners.some((o) => o !== OWN_MEMBER_ID)) return notOwn;
    if (p.total !== wardrobe.total) return done(`Vinted's item count changed while syncing (${wardrobe.total} -> ${p.total ?? "?"}).`, fetched);
    if (p.items.length !== p.rawCount) return done(`Some items on page ${page} couldn't be read.`, fetched);
    for (const it of p.items) byUrl.set(it.url, it);
    if (p.rawCount < perPage) break;
  }
  return done(null, fetched);
}

export type MissingResult = { id: string; title: string; change: string };
export type MissingOutcome = { missing: MissingResult[]; held: string | null };

/** Share of Cooper's active Vinted items a single sync may unpublish; more than this is held for him to check. */
export const MAX_UNPUBLISH_SHARE = 0.3;

/**
 * Items imported from Vinted that are no longer on Cooper's (complete) member listing: sold or removed there.
 * Listed or draft ones are unpublished (archived): only the status changes, never deleted, his edits stay.
 * Sold/archived/trashed items are left alone. Only call this with a confirmed complete list; if it would
 * unpublish more than MAX_UNPUBLISH_SHARE of the active Vinted items, nothing is touched and it's reported.
 */
export async function unpublishMissing(db: typeof Db, presentUrls: string[], maxShare = MAX_UNPUBLISH_SHARE): Promise<MissingOutcome> {
  if (!presentUrls.length) return { missing: [], held: null };
  const active = await db
    .select({ id: products.id, title: products.title, status: products.status, sourceUrl: productImports.sourceUrl })
    .from(productImports)
    .innerJoin(products, eq(products.id, productImports.productId))
    .where(and(eq(productImports.source, "vinted"), eq(products.source, "closet"), inArray(products.status, ["listed", "draft"])));
  const present = new Set(presentUrls);
  const rows = active.filter((r) => !present.has(r.sourceUrl));
  if (!rows.length) return { missing: [], held: null };
  if (rows.length > Math.max(1, active.length * maxShare)) {
    return { missing: [], held: `${rows.length} of ${active.length} Vinted items would be unpublished, which is more than expected, so nothing was unpublished. Check your Vinted shop.` };
  }
  await db.update(products).set({ status: "archived", updatedAt: new Date() }).where(and(inArray(products.id, rows.map((r) => r.id)), eq(products.source, "closet"), inArray(products.status, ["listed", "draft"])));
  return { missing: rows.map((r) => ({ id: r.id, title: r.title, change: r.status === "listed" ? "no longer on Vinted (sold or removed): taken off the shop (archived)" : "no longer on Vinted: draft archived" })), held: null };
}
