import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, inventory, photos, products, sellers } from "@/lib/db/schema";
import { centsToDollars } from "@/lib/commerce/money";
import { mediaUrl } from "@/lib/media";
import { products as staticProducts, shopProducts as staticShopProducts } from "@/lib/data";
import type { Product, ProductCondition, ProductImage, ProductStatus } from "@/lib/types";

const PLACEHOLDER: ProductImage = { id: "placeholder", src: "/placeholder.svg", alt: "Photo coming soon", width: 1200, height: 1000 };

type Row = {
  product: typeof products.$inferSelect;
  inventory: typeof inventory.$inferSelect | null;
  categorySlug: string | null;
};

function toProduct(row: Row, uploaded: (typeof photos.$inferSelect)[]): Product {
  const p = row.product;
  // Keep the legacy id for seeded items so cart/wishlist (static catalog) keep working.
  const legacy = staticProducts.find((s) => s.sku === p.sku);
  const stored = Array.isArray(p.images) ? (p.images as ProductImage[]) : [];
  const images: ProductImage[] = uploaded.length
    ? uploaded.map((ph) => ({ id: ph.id, src: mediaUrl(ph.storagePath), alt: ph.alt || p.title, width: ph.width ?? 1200, height: ph.height ?? 1000 }))
    : stored.length
      ? stored
      : [PLACEHOLDER];
  const onHand = row.inventory?.quantityOnHand ?? 0;
  const reserved = row.inventory?.quantityReserved ?? 0;
  const listed = (p.updatedAt ?? p.createdAt).toISOString();
  return {
    ...(legacy ?? {}),
    id: legacy?.id ?? p.id,
    sku: p.sku,
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: row.categorySlug ?? legacy?.category ?? "home",
    subcategory: legacy?.subcategory ?? "",
    brand: p.brand ?? "",
    condition: p.condition as ProductCondition,
    conditionNotes: p.conditionNotes ?? "",
    price: centsToDollars(p.priceCents),
    originalPrice: p.originalPriceCents != null ? centsToDollars(p.originalPriceCents) : undefined,
    purchaseCost: 0, // never expose cost on the storefront
    quantity: Math.max(0, onHand - reserved),
    images,
    dimensions: legacy?.dimensions ?? { lengthIn: 0, widthIn: 0, heightIn: 0 },
    weightLb: p.weightLb ? Number(p.weightLb) : 0,
    color: legacy?.color ?? "",
    size: legacy?.size ?? "",
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    dateAcquired: legacy?.dateAcquired ?? listed.slice(0, 10),
    dateListed: legacy?.dateListed ?? listed.slice(0, 10),
    featured: p.featured,
    status: p.status as ProductStatus,
    marketplaceListing: legacy?.marketplaceListing ?? [],
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function load(where: ReturnType<typeof and>) {
  const rows = await db
    .select({ product: products, inventory, categorySlug: categories.slug })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where);
  const ids = rows.map((r) => r.product.id);
  const pics = ids.length ? await db.select().from(photos).where(inArray(photos.productId, ids)).orderBy(asc(photos.sortOrder)) : [];
  return rows.map((r) => toProduct(r, pics.filter((ph) => ph.productId === r.product.id)));
}

/** Spock's Closet: listed, in-stock closet items from the DB. Falls back to the static catalog if the DB is unavailable. */
export async function getClosetProducts(): Promise<Product[]> {
  try {
    const items = await load(and(eq(products.source, "closet"), eq(products.status, "listed")));
    return items.filter((p) => p.quantity > 0);
  } catch (error) {
    console.error("closet query failed; using static catalog", error);
    return staticShopProducts;
  }
}

/** Any listed product (closet or community) by slug, with static fallback. */
export async function getListedProductBySlug(slug: string): Promise<Product | undefined> {
  try {
    const [row] = await db
      .select({ source: products.source, sellerStatus: sellers.status })
      .from(products)
      .leftJoin(sellers, eq(sellers.id, products.sellerId))
      .where(eq(products.slug, slug));
    if (!row || row.source === "affiliate") return undefined;
    // Hide community items whose seller is no longer active.
    if (row.source === "community" && row.sellerStatus !== "active") return undefined;
    const [item] = await load(and(eq(products.slug, slug)));
    return item;
  } catch (error) {
    console.error("product query failed; using static catalog", error);
    return staticProducts.find((p) => p.slug === slug);
  }
}
