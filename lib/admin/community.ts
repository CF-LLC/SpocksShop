import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityListings, inventory, photos, products, sellers } from "@/lib/db/schema";
import { AdminInputError } from "@/lib/admin/http";
import { slugify } from "@/lib/admin/forms";

/** Approve a pending listing and publish it as a community product (with its photos). */
export async function approveListing(listingId: string, reviewerId: string, note: string | null) {
  return db.transaction(async (tx) => {
    const [listing] = await tx.select().from(communityListings).where(eq(communityListings.id, listingId)).for("update");
    if (!listing) throw new AdminInputError("Listing not found.");
    if (listing.status !== "pending") throw new AdminInputError(`Listing is ${listing.status}, not pending.`);
    const [seller] = await tx.select().from(sellers).where(eq(sellers.id, listing.sellerId));
    if (!seller || seller.status !== "active") throw new AdminInputError("Seller must be active before approving listings.");

    const suffix = randomBytes(3).toString("hex");
    const [product] = await tx
      .insert(products)
      .values({
        sku: `COM-${suffix.toUpperCase()}`,
        slug: `${slugify(listing.title) || "listing"}-${suffix}`,
        title: listing.title,
        description: listing.description,
        condition: listing.condition ?? "Good",
        priceCents: listing.priceCents,
        status: "listed",
        source: "community",
        sellerId: seller.id,
        uniqueFind: true,
      })
      .returning({ id: products.id });
    await tx.insert(inventory).values({ productId: product.id, quantityOnHand: 1 });
    await tx.update(photos).set({ productId: product.id }).where(eq(photos.communityListingId, listing.id));
    await tx
      .update(communityListings)
      .set({ status: "approved", productId: product.id, moderationNote: note, reviewedBy: reviewerId, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(communityListings.id, listing.id));
    return product.id;
  });
}

export async function rejectListing(listingId: string, reviewerId: string, note: string) {
  if (!note.trim()) throw new AdminInputError("Add a note so the seller knows why.");
  const updated = await db
    .update(communityListings)
    .set({ status: "rejected", moderationNote: note.trim(), reviewedBy: reviewerId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(communityListings.id, listingId))
    .returning({ status: communityListings.status });
  if (updated.length === 0) throw new AdminInputError("Listing not found.");
}
