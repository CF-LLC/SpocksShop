import { z } from "zod";
import { normalizeAffiliateCategory } from "./categories";
import { AMAZON_ASSOCIATE_TAG, buildAffiliateUrlFromAsin, isValidAsin, withAffiliateTag } from "../commerce/affiliate";

/**
 * Bulk import of Amazon picks into affiliate_items.
 * Input: a JSON array (or { items: [...] }) of picks. `display_title` (<=60 chars) becomes the card title and
 * the original `title` is kept as full_title; `blurb` is stored and shown on the card. Other unknown fields are ignored.
 */
const optionalString = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().optional());

export const affiliatePickSchema = z
  .object({
    title: z.string().trim().min(2),
    display_title: optionalString.pipe(z.string().max(60, "display_title must be 60 characters or less").optional()),
    blurb: optionalString.pipe(z.string().max(300, "blurb must be 300 characters or less").optional()),
    asin: z.preprocess(
      (v) => (v === "" || v === null ? undefined : typeof v === "string" ? v.trim().toUpperCase() : v),
      z.string().refine(isValidAsin, "ASIN must be 10 letters/digits").optional(),
    ),
    link: optionalString.pipe(z.string().url().optional()),
    amazon_url: optionalString.pipe(z.string().url().optional()),
    image_url: optionalString.pipe(z.string().url().optional()),
    price: z.union([z.number().nonnegative(), z.string().trim()]).nullish(),
    price_checked: optionalString,
    category: z.unknown().transform((v, ctx) => {
      const c = normalizeAffiliateCategory(v);
      if (c === "invalid") { ctx.addIssue({ code: "custom", message: `Unknown category "${String(v)}" (use spock, necessities or home)` }); return z.NEVER; }
      return c ?? undefined;
    }).optional(),
    active: z.boolean().optional(),
    sort_order: z.number().int().min(-10000).max(10000).optional(),
  })
  .passthrough()
  .refine((d) => d.asin || d.link || d.amazon_url, { message: "Each pick needs an asin or a link" });

export const affiliateBatchSchema = z.union([
  z.array(affiliatePickSchema).min(1).max(500),
  z.object({ items: z.array(affiliatePickSchema).min(1).max(500) }).transform((o) => o.items),
]);

export type AffiliatePick = z.infer<typeof affiliatePickSchema>;

export type AffiliateRow = {
  title: string;
  asin: string | null;
  amazonUrl: string;
  imageUrl: string | null;
  priceNote: string;
  /** Full Amazon title when `title` is a shortened display title, else null. */
  fullTitle: string | null;
  blurb: string | null;
  /** undefined = leave existing value untouched on update */
  category?: string;
  active: boolean;
  sortOrder: number;
};

/** "$12.24" | "12.24" | 12.24 → "$12.24"; anything else → null. */
export function formatPrice(price: AffiliatePick["price"]): string | null {
  if (price == null) return null;
  const n = typeof price === "number" ? price : Number(price.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return `$${n.toFixed(2)}`;
}

export function priceNoteFor(price: AffiliatePick["price"]): string {
  const p = formatPrice(price);
  return p ? `About ${p}, price may vary on Amazon` : "Price may vary on Amazon";
}

const ASIN_IN_URL = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;

export function asinFromUrl(url: string): string | null {
  const m = ASIN_IN_URL.exec(url);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Canonical link: https://www.amazon.com/dp/<ASIN>?tag=mrspock-20 when the ASIN is known
 * (drops other query params and any foreign tag); otherwise the given Amazon URL with tag forced.
 */
export function normalizePick(pick: AffiliatePick, index: number): AffiliateRow {
  const rawLink = pick.link ?? pick.amazon_url;
  if (rawLink) {
    try { withAffiliateTag(rawLink); } catch (e) { throw new Error(`Pick ${index + 1}: ${(e as Error).message}`); }
  }
  const asin = pick.asin ?? (rawLink ? asinFromUrl(rawLink) : null);
  if (rawLink && pick.asin) {
    const fromUrl = asinFromUrl(rawLink);
    if (fromUrl && fromUrl !== pick.asin) throw new Error(`Pick ${index + 1}: link ASIN ${fromUrl} does not match asin ${pick.asin}`);
  }
  const amazonUrl = asin ? buildAffiliateUrlFromAsin(asin) : withAffiliateTag(rawLink!);
  const url = new URL(amazonUrl);
  if (url.searchParams.get("tag") !== AMAZON_ASSOCIATE_TAG) throw new Error("tag not applied");
  return {
    title: (pick.display_title ?? pick.title).slice(0, 200),
    fullTitle: pick.display_title && pick.display_title !== pick.title ? pick.title.slice(0, 500) : null,
    blurb: pick.blurb ?? null,
    asin,
    amazonUrl,
    imageUrl: pick.image_url && pick.image_url.startsWith("https://") ? pick.image_url : null,
    priceNote: priceNoteFor(pick.price),
    ...(pick.category ? { category: pick.category } : {}),
    active: pick.active ?? true,
    sortOrder: pick.sort_order ?? (index + 1) * 10,
  };
}

export type ParseResult = { ok: true; rows: AffiliateRow[] } | { ok: false; errors: string[] };

export function parseAffiliateBatch(input: unknown): ParseResult {
  const parsed = affiliateBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const errors: string[] = [];
  const rows: AffiliateRow[] = [];
  const seen = new Set<string>();
  parsed.data.forEach((p, i) => {
    try {
      const row = normalizePick(p, i);
      const key = row.asin ?? row.amazonUrl;
      if (seen.has(key)) throw new Error(`Pick ${i + 1}: duplicate ${row.asin ? "ASIN " + row.asin : "link"}`);
      seen.add(key);
      rows.push(row);
    } catch (e) {
      errors.push((e as Error).message);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, rows };
}
