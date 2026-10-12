import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityListings, photos, sellers } from "@/lib/db/schema";
import { getSellerSession } from "@/lib/auth/seller-session";
import { dollarsToCents } from "@/lib/commerce/money";
import { MAX_PHOTOS, MediaError, deleteMedia, photoFiles, savePhoto, validatePhoto } from "@/lib/media";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";
import { listingSchema } from "@/lib/sell/validation";

export async function POST(request: Request) {
  if (sellersDisabled()) return notFoundResponse();
  const session = await getSellerSession();
  if (!session) return redirectTo(request, "/sell/login");

  const [seller] = await db.select().from(sellers).where(eq(sellers.id, session.sellerId));
  if (!seller || seller.status !== "active") {
    return redirectTo(request, "/sell/dashboard", "Your seller account must be approved before you can submit listings.");
  }

  const form = await request.formData();
  const parsed = listingSchema.safeParse({
    title: form.get("title"),
    description: form.get("description") ?? "",
    condition: form.get("condition") || undefined,
    price: form.get("price"),
  });
  if (!parsed.success) return redirectTo(request, "/sell/dashboard", "Add a title (3+ characters) and a price.");

  const files = photoFiles(form);
  if (files.length === 0) return redirectTo(request, "/sell/dashboard", "Add at least one photo.");
  if (files.length > MAX_PHOTOS) return redirectTo(request, "/sell/dashboard", `Up to ${MAX_PHOTOS} photos per listing.`);
  try {
    files.forEach(validatePhoto);
  } catch (e) {
    return redirectTo(request, "/sell/dashboard", e instanceof MediaError ? e.message : "Invalid photo.");
  }

  const saved: string[] = [];
  try {
    for (const file of files) saved.push(await savePhoto(file, `community/${seller.id}`));
    await db.transaction(async (tx) => {
      const [listing] = await tx
        .insert(communityListings)
        .values({
          sellerId: seller.id,
          title: parsed.data.title,
          description: parsed.data.description,
          condition: parsed.data.condition ?? null,
          priceCents: dollarsToCents(parsed.data.price),
          status: "pending",
        })
        .returning();
      await tx.insert(photos).values(
        saved.map((storagePath, i) => ({ communityListingId: listing.id, storagePath, alt: parsed.data.title, sortOrder: i })),
      );
    });
  } catch (error) {
    await Promise.all(saved.map(deleteMedia));
    throw error;
  }
  return redirectTo(request, "/sell/dashboard?submitted=1");
}
