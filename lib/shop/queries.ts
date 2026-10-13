import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateItems, communityListings, photos, products, sellers } from "@/lib/db/schema";

export type AffiliateCard = typeof affiliateItems.$inferSelect;
export type CommunityCard = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  sellerName: string;
  photoPath: string | null;
  slug: string | null;
};

/** Never let a DB outage take down the storefront: fall back to an empty section. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("shop query failed", error);
    return fallback;
  }
}

export function activeAffiliateItems() {
  return safe(
    () => db.select().from(affiliateItems).where(eq(affiliateItems.active, true)).orderBy(asc(affiliateItems.sortOrder), asc(affiliateItems.title)),
    [] as AffiliateCard[],
  );
}

/** Approved community listings from active sellers only. */
export function approvedCommunityListings(): Promise<CommunityCard[]> {
  return safe(async () => {
    const rows = await db
      .select({
        id: communityListings.id,
        title: communityListings.title,
        description: communityListings.description,
        priceCents: communityListings.priceCents,
        sellerName: sellers.displayName,
        productStatus: products.status,
        slug: products.slug,
      })
      .from(communityListings)
      .innerJoin(sellers, eq(sellers.id, communityListings.sellerId))
      .leftJoin(products, eq(products.id, communityListings.productId))
      .where(and(eq(communityListings.status, "approved"), eq(sellers.status, "active")))
      .orderBy(desc(communityListings.reviewedAt));
    const visible = rows.filter((r) => r.productStatus !== "sold" && r.productStatus !== "archived");
    const ids = visible.map((r) => r.id);
    const pics = ids.length
      ? await db.select().from(photos).where(inArray(photos.communityListingId, ids)).orderBy(asc(photos.sortOrder))
      : [];
    return visible.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      priceCents: r.priceCents,
      sellerName: r.sellerName,
      slug: r.slug,
      photoPath: pics.find((p) => p.communityListingId === r.id)?.storagePath ?? null,
    }));
  }, []);
}
