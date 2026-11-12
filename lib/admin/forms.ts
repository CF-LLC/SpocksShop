import { randomBytes } from "crypto";
import { z } from "zod";
import { AFFILIATE_CATEGORY_SLUGS } from "@/lib/affiliate/categories";
import { withAffiliateTag } from "@/lib/commerce/affiliate";
import { dollarsToCents } from "@/lib/commerce/money";
import { productConditions } from "@/lib/types";
import { AdminInputError } from "@/lib/admin/http";
import { closetWeightLb } from "@/lib/commerce/closet-weight";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(4000).optional());
const optionalMoney = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().nonnegative().max(1_000_000).optional());

export const closetItemSchema = z.object({
  title: z.string().trim().min(2).max(160),
  sku: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().min(2).max(40).optional()),
  slug: optionalText,
  description: z.string().trim().max(8000).default(""),
  categoryId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
  brand: optionalText,
  condition: z.enum(productConditions),
  conditionNotes: optionalText,
  price: z.coerce.number().positive().max(1_000_000),
  originalPrice: optionalMoney,
  purchaseCost: optionalMoney,
  weightLb: optionalMoney,
  quantity: z.coerce.number().int().min(0).max(10_000),
  status: z.enum(["draft", "listed", "reserved", "pending_approval", "sold", "archived"]),
  featured: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  requiresApproval: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

/** SRS-YYMMDD-XXXX when the admin leaves SKU blank (phone-friendly). */
export function autoSku(now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  return `SRS-${d}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export function parseClosetForm(form: FormData) {
  const parsed = closetItemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AdminInputError(`Check ${issue?.path.join(".") || "the form"}: ${issue?.message ?? "invalid"}`);
  }
  const d = parsed.data;
  // Same rule as the admin Publish action: live items need stock (price > 0 is enforced by the schema).
  if (d.status === "listed" && d.quantity < 1) {
    throw new AdminInputError("Live items need a quantity of at least 1. Set quantity to 1 or save as Draft.");
  }
  return {
    product: {
      title: d.title,
      sku: (d.sku ?? autoSku()).toUpperCase(),
      slug: slugify(d.slug || d.title),
      description: d.description,
      categoryId: d.categoryId ?? null,
      brand: d.brand ?? null,
      condition: d.condition,
      conditionNotes: d.conditionNotes ?? null,
      priceCents: dollarsToCents(d.price),
      originalPriceCents: d.originalPrice != null ? dollarsToCents(d.originalPrice) : null,
      purchaseCostCents: d.purchaseCost != null ? dollarsToCents(d.purchaseCost) : null,
      weightLb: closetWeightLb(d.weightLb),
      status: d.status,
      featured: d.featured,
      // Closet Picks default to needing approval; only a form that shows the checkbox can turn it off.
      requiresApproval: form.has("requiresApprovalField") ? d.requiresApproval : true,
      uniqueFind: d.quantity <= 1,
      source: "closet" as const,
    },
    quantity: d.quantity,
  };
}

export const affiliateItemSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    imageUrl: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v), z.string().url().max(2000).optional()),
    amazonUrl: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v), z.string().url().max(2000).optional()),
    asin: z.preprocess((v) => (v === "" ? undefined : typeof v === "string" ? v.trim().toUpperCase() : v), z.string().regex(/^[A-Z0-9]{10}$/, "ASIN must be 10 letters/digits").optional()),
    priceNote: optionalText,
    /** Short curator line shown on the public pick card. */
    blurb: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(300).optional()),
    /** Curator "why it's today's pick" line. Empty clears it; Daily Pick then uses its generated fallback. */
    why: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(500).optional()),
    /** Full Amazon title when `title` is a shortened display title. */
    fullTitle: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(500).optional()),
    category: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(AFFILIATE_CATEGORY_SLUGS).nullable()).default(null),
    active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    sortOrder: z.coerce.number().int().min(-10000).max(10000).default(0),
  })
  .refine((d) => d.amazonUrl || d.asin, { message: "Add an Amazon URL or an ASIN", path: ["amazonUrl"] });

export type AffiliateItemInput = z.infer<typeof affiliateItemSchema>;

/** Amazon URLs are stored with tag=mrspock-20. Non-Amazon URLs are left as entered. */
function storedAmazonUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return withAffiliateTag(url);
  } catch {
    return url;
  }
}

/**
 * Columns written on create/update. Empty optional fields become null so a blank
 * input clears them. Every curator column is present, so a save cannot drop blurb/why/fullTitle.
 */
export function affiliateItemWrite(data: AffiliateItemInput) {
  return {
    title: data.title,
    imageUrl: data.imageUrl ?? null,
    amazonUrl: storedAmazonUrl(data.amazonUrl),
    asin: data.asin ?? null,
    priceNote: data.priceNote ?? null,
    blurb: data.blurb ?? null,
    why: data.why ?? null,
    fullTitle: data.fullTitle ?? null,
    category: data.category,
    active: data.active,
    sortOrder: data.sortOrder,
  };
}

/** Move item at `index` up or down; returns the new order (array of ids). */
export function reorder<T>(items: T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
