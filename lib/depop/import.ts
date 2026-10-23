import { randomUUID } from "crypto";
import { logError } from "@/lib/errors/log";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";
import { inventory, photos, productImports, products } from "@/lib/db/schema";
import { autoSku, slugify } from "@/lib/admin/forms";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, deleteMedia, savePhoto, sniffImage, CONTENT_TYPES } from "@/lib/media";
import { FetchError, isBlocked, isUserFacing, MAX_PAGE_BYTES, POLITE_DELAY_MS, httpFetch, sleep, type Fetcher } from "./fetch";
import { DepopParseError, parseDepopListing, type DepopListing } from "./parse";
import { isAllowedPhotoUrl, parseLinkList } from "./url";

export type LinkResult =
  | { input: string; status: "imported"; id: string; title: string; photos: number; note?: string }
  | { input: string; status: "duplicate"; id: string | null; title: string | null }
  | { input: string; status: "sold"; title: string }
  | { input: string; status: "updated"; id: string; title: string; changes: string[] }
  | { input: string; status: "error"; error: string };

/** What SpockShop has now for an imported link (lets a re-paste update it). */
export type CurrentItem = { title: string; priceCents: number; description: string; size: string | null; status: string; photoUrls: string[] | null; photoCount: number };
export type ItemUpdate = {
  set: Partial<{ title: string; priceCents: number; description: string; tags: string[]; status: string }>;
  /** Replace the item's photos with these (already saved) files. */
  photoPaths?: string[];
  photoUrls: string[];
};
export type ImportStore = {
  existing(urls: string[]): Promise<Map<string, { id: string; title: string; current?: CurrentItem }>>;
  update?(id: string, u: ItemUpdate): Promise<{ removedPaths: string[] }>;
  create(input: { id: string; listing: DepopListing; url: string; photoPaths: string[] }): Promise<void>;
};

export type ImportDeps = {
  fetcher?: Fetcher;
  store: ImportStore;
  savePhotoBytes?: (bytes: Uint8Array, ext: string, folder: string) => Promise<string>;
  removePhoto?: (relative: string) => Promise<void>;
  delayMs?: number;
  wait?: (ms: number) => Promise<void>;
  /** Called after each link is handled (bulk jobs use it for live progress). */
  onResult?: (r: LinkResult) => void;
  /** Refresh items that are already imported (only when pages come from the bookmark, never a server crawl). */
  refreshExisting?: boolean;
  /** Max links read from the text (default 20). */
  maxLinks?: number;
};

export const BLOCKED_SKIP = "Not tried: Depop asked us to slow down, so the import stopped. Paste this link again later or add it by hand.";

async function defaultSave(bytes: Uint8Array, ext: string, folder: string) {
  const type = CONTENT_TYPES[ext];
  return savePhoto(new File([new Uint8Array(bytes)], `depop.${ext}`, { type }), folder);
}

/** Import each pasted link in order, one page at a time with a polite pause between requests. */
export async function importDepopLinks(text: string, deps: ImportDeps): Promise<{ results: LinkResult[]; tooMany: boolean; stopped: boolean }> {
  const fetcher = deps.fetcher ?? httpFetch;
  const wait = deps.wait ?? sleep;
  const delay = deps.delayMs ?? POLITE_DELAY_MS;
  const save = deps.savePhotoBytes ?? defaultSave;
  const remove = deps.removePhoto ?? deleteMedia;
  const { lines, tooMany } = parseLinkList(text, deps.maxLinks);
  const validUrls = lines.flatMap((l) => (l.check.ok ? [l.check.url] : []));
  const existing = validUrls.length ? await deps.store.existing([...new Set(validUrls)]) : new Map();
  const seen = new Set<string>();
  const results: LinkResult[] = [];
  const push = (r: LinkResult) => { results.push(r); deps.onResult?.(r); };
  let requested = false;
  let stopped = false;

  for (const { input, check } of lines) {
    if (stopped) { push({ input, status: "error", error: BLOCKED_SKIP }); continue; }
    if (!check.ok) { push({ input, status: "error", error: check.error }); continue; }
    const dup = existing.get(check.url);
    if (dup && (!deps.refreshExisting || !dup.current || !deps.store.update)) { push({ input, status: "duplicate", id: dup.id, title: dup.title }); continue; }
    if (seen.has(check.url)) { push({ input, status: "duplicate", id: null, title: "Listed twice in this paste" }); continue; }
    seen.add(check.url);

    if (requested) await wait(delay);
    requested = true;
    const saved: string[] = [];
    try {
      const page = await fetcher(check.url, { maxBytes: MAX_PAGE_BYTES, accept: "text/html" });
      if (!/html/i.test(page.contentType)) throw new FetchError("Depop didn't return a web page.");
      const listing = parseDepopListing(new TextDecoder().decode(page.bytes));
      if (dup?.current) {
        push(await refreshExisting(input, dup.id, dup.current, listing, { fetcher, wait, delay, save, remove, store: deps.store, saved }));
        continue;
      }
      // Already sold on Depop: no draft, no photo downloads.
      if (listing.sold) { push({ input, status: "sold", title: listing.title }); continue; }
      if (listing.priceCents == null) throw new DepopParseError("Couldn't find a price on that page.");
      const id = randomUUID();
      const photoUrls = listing.photos.filter(isAllowedPhotoUrl).slice(0, MAX_PHOTOS);
      let skipped = listing.photos.length - photoUrls.length;
      for (const url of photoUrls) {
        await wait(Math.min(delay, 500));
        try {
          const img = await fetcher(url, { maxBytes: MAX_PHOTO_BYTES, accept: "image/jpeg,image/png,image/webp" });
          const ext = sniffImage(img.bytes);
          if (!ext) { skipped++; continue; }
          saved.push(await save(img.bytes, ext, `closet/${id}`));
        } catch {
          skipped++;
        }
      }
      await deps.store.create({ id, listing, url: check.url, photoPaths: saved });
      const notes = [skipped ? `${skipped} photo${skipped === 1 ? "" : "s"} skipped` : "", listing.currency && listing.currency.toUpperCase() !== "USD" ? `price was in ${listing.currency}, check it` : ""].filter(Boolean);
      push({ input, status: "imported", id, title: listing.title, photos: saved.length, ...(notes.length ? { note: notes.join("; ") } : {}) });
    } catch (e) {
      await Promise.all(saved.map((p) => remove(p)));
      const error = isUserFacing(e) ? e.message : "Unexpected error while importing (logged).";
      if (!isUserFacing(e)) await logError("depop-import", e, { url: check.url });
      if (isBlocked(e)) stopped = true;
      push({ input, status: "error", error });
    }
  }
  return { results, tooMany, stopped };
}

const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const sizeOf = (tags: unknown) => (Array.isArray(tags) ? (tags.find((t) => typeof t === "string" && t.startsWith("size:")) as string | undefined)?.slice(5) ?? null : null);
export { sizeOf };
/** Statuses a sold-on-Depop item may be switched to Sold from (never touch open orders or Trash). */
const SOLD_FROM = new Set(["draft", "listed", "archived"]);

type RefreshCtx = { fetcher: Fetcher; wait: (ms: number) => Promise<void>; delay: number; save: (b: Uint8Array, e: string, f: string) => Promise<string>; remove: (p: string) => Promise<void>; store: ImportStore; saved: string[] };

/** A pasted link that is already in SpockShop: refresh it from the page instead of skipping. Never deletes the item. */
async function refreshExisting(input: string, id: string, cur: CurrentItem, l: DepopListing, ctx: RefreshCtx): Promise<LinkResult> {
  const changes: string[] = [];
  const set: ItemUpdate["set"] = {};
  if (l.sold) {
    if (SOLD_FROM.has(cur.status)) { set.status = "sold"; changes.push(cur.status === "listed" ? "sold on Depop: marked Sold and taken off the shop" : "sold on Depop: marked Sold"); }
    else if (cur.status !== "sold") changes.push(`sold on Depop, but left as ${cur.status} (check it)`);
  }
  if (l.title && l.title !== cur.title) { set.title = l.title; changes.push(`title "${cur.title}" to "${l.title}"`); }
  if (l.priceCents != null && l.priceCents !== cur.priceCents) { set.priceCents = l.priceCents; changes.push(`price ${money(cur.priceCents)} to ${money(l.priceCents)}`); }
  const desc = draftDescription(l);
  if (desc && desc !== cur.description) { set.description = desc; changes.push("description"); }
  if (l.size && l.size !== cur.size) { set.tags = [`size:${l.size}`]; changes.push(`size ${cur.size ?? "none"} to ${l.size}`); }
  const urls = l.photos.filter(isAllowedPhotoUrl).slice(0, MAX_PHOTOS);
  // Legacy imports (no recorded URLs) only get photos if they have none, so hand edits/cutouts aren't replaced blindly.
  const photosChanged = urls.length > 0 && !l.sold && (cur.photoUrls ? cur.photoUrls.join("\n") !== urls.join("\n") : cur.photoCount === 0);
  let photoPaths: string[] | undefined;
  if (photosChanged) {
    for (const url of urls) {
      await ctx.wait(Math.min(ctx.delay, 500));
      try {
        const img = await ctx.fetcher(url, { maxBytes: MAX_PHOTO_BYTES, accept: "image/jpeg,image/png,image/webp" });
        const ext = sniffImage(img.bytes);
        if (ext) ctx.saved.push(await ctx.save(img.bytes, ext, `closet/${id}`));
      } catch { /* skip that photo */ }
    }
    if (ctx.saved.length) { photoPaths = [...ctx.saved]; changes.push(`photos (${ctx.saved.length})`); }
  }
  if (!changes.length) {
    if (!cur.photoUrls) await ctx.store.update!(id, { set: {}, photoUrls: urls });
    return { input, status: "duplicate", id, title: cur.title };
  }
  const { removedPaths } = await ctx.store.update!(id, { set, photoPaths, photoUrls: urls });
  await Promise.all(removedPaths.map((p) => ctx.remove(p)));
  return { input, status: "updated", id, title: set.title ?? cur.title, changes };
}

/** Draft description: Depop text plus size, so nothing is lost; Cooper edits it in the item editor. */
export function draftDescription(l: DepopListing): string {
  const head = [l.size ? `Size: ${l.size}` : "", l.brand ? `Brand: ${l.brand}` : ""].filter(Boolean).join("\n");
  return [head, l.description].filter(Boolean).join("\n\n").slice(0, 8000);
}

export function dbStore(db: typeof Db): ImportStore {
  return {
    async existing(urls) {
      const rows = await db
        .select({
          url: productImports.sourceUrl, id: products.id, title: products.title, priceCents: products.priceCents, description: products.description,
          tags: products.tags, status: products.status, photoUrls: productImports.photoUrls,
          photoCount: sql<number>`(select count(*)::int from ${photos} where ${photos.productId} = ${products.id})`,
        })
        .from(productImports)
        .innerJoin(products, eq(products.id, productImports.productId))
        .where(and(eq(productImports.source, "depop"), inArray(productImports.sourceUrl, urls)));
      return new Map(rows.map((r) => [r.url, {
        id: r.id, title: r.title,
        current: { title: r.title, priceCents: r.priceCents, description: r.description, size: sizeOf(r.tags), status: r.status, photoUrls: r.photoUrls ?? null, photoCount: r.photoCount },
      }]));
    },
    async update(id, u) {
      return db.transaction(async (tx) => {
        let removedPaths: string[] = [];
        if (Object.keys(u.set).length) {
          const [p] = await tx.select({ tags: products.tags }).from(products).where(eq(products.id, id));
          const set = { ...u.set } as Record<string, unknown>;
          if (u.set.tags) set.tags = [...(Array.isArray(p?.tags) ? (p!.tags as string[]).filter((t) => !String(t).startsWith("size:")) : []), ...u.set.tags];
          await tx.update(products).set({ ...set, updatedAt: new Date() }).where(and(eq(products.id, id), eq(products.source, "closet")));
        }
        if (u.photoPaths?.length) {
          const old = await tx.select({ path: photos.storagePath }).from(photos).where(eq(photos.productId, id)).orderBy(asc(photos.sortOrder));
          await tx.delete(photos).where(eq(photos.productId, id));
          const [p] = await tx.select({ title: products.title }).from(products).where(eq(products.id, id));
          await tx.insert(photos).values(u.photoPaths.map((storagePath, i) => ({ productId: id, storagePath, alt: p?.title ?? "", sortOrder: i })));
          removedPaths = old.map((o) => o.path);
        }
        await tx.update(productImports).set({ photoUrls: u.photoUrls, syncedAt: new Date() }).where(and(eq(productImports.productId, id), eq(productImports.source, "depop")));
        return { removedPaths };
      });
    },
    async create({ id, listing, url, photoPaths }) {
      await db.transaction(async (tx) => {
        await tx.insert(products).values({
          id,
          sku: autoSku(),
          slug: `${slugify(listing.title).slice(0, 70) || "item"}-${id.slice(0, 6)}`,
          title: listing.title,
          description: draftDescription(listing),
          brand: listing.brand,
          condition: listing.condition,
          conditionNotes: listing.conditionLabel ? `Depop condition: ${listing.conditionLabel}` : null,
          priceCents: listing.priceCents!,
          status: "draft",
          requiresApproval: true,
          uniqueFind: true,
          source: "closet",
          tags: listing.size ? [`size:${listing.size}`] : [],
        });
        await tx.insert(inventory).values({ productId: id, quantityOnHand: 1 });
        if (photoPaths.length) await tx.insert(photos).values(photoPaths.map((storagePath, i) => ({ productId: id, storagePath, alt: listing.title, sortOrder: i })));
        await tx.insert(productImports).values({ productId: id, source: "depop", sourceUrl: url, photoUrls: listing.photos.filter(isAllowedPhotoUrl).slice(0, MAX_PHOTOS), syncedAt: new Date() });
      });
    },
  };
}
