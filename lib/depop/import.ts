import { randomUUID } from "crypto";
import { logError } from "@/lib/errors/log";
import { and, eq, inArray } from "drizzle-orm";
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
  | { input: string; status: "error"; error: string };

export type ImportStore = {
  existing(urls: string[]): Promise<Map<string, { id: string; title: string }>>;
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
    if (dup) { push({ input, status: "duplicate", id: dup.id, title: dup.title }); continue; }
    if (seen.has(check.url)) { push({ input, status: "duplicate", id: null, title: "Listed twice in this paste" }); continue; }
    seen.add(check.url);

    if (requested) await wait(delay);
    requested = true;
    const saved: string[] = [];
    try {
      const page = await fetcher(check.url, { maxBytes: MAX_PAGE_BYTES, accept: "text/html" });
      if (!/html/i.test(page.contentType)) throw new FetchError("Depop didn't return a web page.");
      const listing = parseDepopListing(new TextDecoder().decode(page.bytes));
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

/** Draft description: Depop text plus size, so nothing is lost; Cooper edits it in the item editor. */
export function draftDescription(l: DepopListing): string {
  const head = [l.size ? `Size: ${l.size}` : "", l.brand ? `Brand: ${l.brand}` : ""].filter(Boolean).join("\n");
  return [head, l.description].filter(Boolean).join("\n\n").slice(0, 8000);
}

export function dbStore(db: typeof Db): ImportStore {
  return {
    async existing(urls) {
      const rows = await db
        .select({ url: productImports.sourceUrl, id: products.id, title: products.title })
        .from(productImports)
        .innerJoin(products, eq(products.id, productImports.productId))
        .where(and(eq(productImports.source, "depop"), inArray(productImports.sourceUrl, urls)));
      return new Map(rows.map((r) => [r.url, { id: r.id, title: r.title }]));
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
        await tx.insert(productImports).values({ productId: id, source: "depop", sourceUrl: url });
      });
    },
  };
}
