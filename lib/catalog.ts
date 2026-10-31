import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { publicConditionNotes } from "@/lib/importer/public-text";
import { db } from "@/lib/db";
import { categories, inventory, photos, products, sellers } from "@/lib/db/schema";
import { communitySellersEnabled } from "@/lib/features";
import { mediaUrl } from "@/lib/media";
import type { CartProduct, Product, ProductImage, ProductStatus } from "@/lib/types";

export const PLACEHOLDER_IMAGE: ProductImage = { id: "placeholder", src: "/placeholder.svg", alt: "Photo coming soon", width: 1200, height: 1000 };

type Row = {
  product: typeof products.$inferSelect;
  inventory: typeof inventory.$inferSelect | null;
  categoryName: string | null;
  sellerName: string | null;
};

function isHttpImage(value: unknown): value is ProductImage {
  return typeof value === "object" && value !== null && typeof (value as ProductImage).src === "string";
}

export function toProduct(row: Row, uploaded: (typeof photos.$inferSelect)[]): Product {
  const p = row.product;
  const stored = Array.isArray(p.images) ? (p.images as unknown[]).filter(isHttpImage) : [];
  const images: ProductImage[] = uploaded.length
    ? uploaded.map((ph) => ({ id: ph.id, src: mediaUrl(ph.storagePath), alt: ph.alt || p.title, width: ph.width ?? 1200, height: ph.height ?? 1000 }))
    : stored;
  const onHand = row.inventory?.quantityOnHand ?? 0;
  const reserved = row.inventory?.quantityReserved ?? 0;
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    title: p.title,
    description: p.description,
    source: p.source === "community" ? "community" : "closet",
    categoryName: row.categoryName,
    brand: p.brand ?? "",
    condition: p.condition,
    conditionNotes: publicConditionNotes(p.conditionNotes),
    priceCents: p.priceCents,
    originalPriceCents: p.originalPriceCents,
    available: Math.max(0, onHand - reserved),
    images: images.length ? images : [PLACEHOLDER_IMAGE],
    hasPhotos: images.length > 0,
    weightLb: p.weightLb ? Number(p.weightLb) : 0,
    sellerName: row.sellerName,
    status: p.status as ProductStatus,
    listedAt: p.updatedAt.toISOString(),
  };
}

async function load(where: SQL | undefined): Promise<Product[]> {
  const rows = await db
    .select({ product: products, inventory, categoryName: categories.name, sellerName: sellers.displayName })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(sellers, eq(sellers.id, products.sellerId))
    .where(where)
    .orderBy(desc(products.featured), desc(products.updatedAt));
  const ids = rows.map((r) => r.product.id);
  const pics = ids.length ? await db.select().from(photos).where(inArray(photos.productId, ids)).orderBy(asc(photos.sortOrder)) : [];
  return rows.map((r) => toProduct(r, pics.filter((ph) => ph.productId === r.product.id)));
}

/** A storefront that can't reach the DB shows empty states, never stale or sample data. */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`${label} failed`, error);
    return fallback;
  }
}

/** Spock's Closet: listed, in-stock closet items. */
export function getClosetProducts(): Promise<Product[]> {
  return safe(
    "closet query",
    async () => (await load(and(eq(products.source, "closet"), eq(products.status, "listed")))).filter((p) => p.available > 0),
    [],
  );
}

/** A listed closet or community product by slug (affiliate rows never have pages; inactive sellers are hidden). */
export function getListedProductBySlug(slug: string): Promise<Product | undefined> {
  return safe(
    "product query",
    async () => {
      const [item] = await load(and(eq(products.slug, slug), inArray(products.source, ["closet", "community"])));
      if (!item) return undefined;
      if (item.status === "draft" || item.status === "archived") return undefined;
      if (item.source === "community") {
        const [row] = await db.select({ status: sellers.status }).from(products).innerJoin(sellers, eq(sellers.id, products.sellerId)).where(eq(products.id, item.id));
        if (row?.status !== "active") return undefined;
      }
      return item;
    },
    undefined,
  );
}

/** Whether a product may go through checkout right now. Community items wait for the seller flag. */
export function isPurchasable(p: Pick<Product, "source" | "status" | "available">, env: Record<string, string | undefined> = process.env): boolean {
  if (p.status !== "listed" || p.available <= 0) return false;
  if (p.source === "community") return communitySellersEnabled(env);
  return true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Current price/stock for cart lines. Unknown or malformed ids are dropped. */
export function getCartProducts(ids: string[]): Promise<CartProduct[]> {
  const clean = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, 50);
  if (clean.length === 0) return Promise.resolve([]);
  return safe(
    "cart query",
    async () =>
      (await load(and(inArray(products.id, clean), inArray(products.source, ["closet", "community"])))).map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        priceCents: p.priceCents,
        available: p.status === "listed" ? p.available : 0,
        image: p.hasPhotos ? p.images[0].src : null,
        source: p.source,
        purchasable: isPurchasable(p),
      })),
    [],
  );
}
