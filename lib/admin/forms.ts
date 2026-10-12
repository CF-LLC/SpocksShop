import { z } from "zod";
import { dollarsToCents } from "@/lib/commerce/money";
import { productConditions } from "@/lib/types";
import { AdminInputError } from "@/lib/admin/http";

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
  sku: z.string().trim().min(2).max(40),
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
  status: z.enum(["draft", "listed", "reserved", "sold", "archived"]),
  featured: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export function parseClosetForm(form: FormData) {
  const parsed = closetItemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AdminInputError(`Check ${issue?.path.join(".") || "the form"}: ${issue?.message ?? "invalid"}`);
  }
  const d = parsed.data;
  return {
    product: {
      title: d.title,
      sku: d.sku.toUpperCase(),
      slug: slugify(d.slug || d.title),
      description: d.description,
      categoryId: d.categoryId ?? null,
      brand: d.brand ?? null,
      condition: d.condition,
      conditionNotes: d.conditionNotes ?? null,
      priceCents: dollarsToCents(d.price),
      originalPriceCents: d.originalPrice != null ? dollarsToCents(d.originalPrice) : null,
      purchaseCostCents: d.purchaseCost != null ? dollarsToCents(d.purchaseCost) : null,
      weightLb: d.weightLb != null ? String(d.weightLb) : null,
      status: d.status,
      featured: d.featured,
      uniqueFind: d.quantity <= 1,
      source: "closet" as const,
    },
    quantity: d.quantity,
  };
}

export const affiliateItemSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    imageUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().max(2000).optional()),
    amazonUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().max(2000).optional()),
    asin: z.preprocess((v) => (v === "" ? undefined : typeof v === "string" ? v.trim().toUpperCase() : v), z.string().regex(/^[A-Z0-9]{10}$/, "ASIN must be 10 letters/digits").optional()),
    priceNote: optionalText,
    active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    sortOrder: z.coerce.number().int().min(-10000).max(10000).default(0),
  })
  .refine((d) => d.amazonUrl || d.asin, { message: "Add an Amazon URL or an ASIN", path: ["amazonUrl"] });

/** Move item at `index` up or down; returns the new order (array of ids). */
export function reorder<T>(items: T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
