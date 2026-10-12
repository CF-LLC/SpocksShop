import { eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { photos, products } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { MAX_PHOTOS, MediaError, deleteMedia, photoFiles, savePhoto, validatePhoto } from "@/lib/media";

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminForm<Ctx>("/admin/closet", async ({ request, form, context }) => {
  const { id } = await context.params;
  const [product] = await db.select({ id: products.id, title: products.title }).from(products).where(eq(products.id, id));
  if (!product) throw new AdminInputError("Item not found.");
  const files = photoFiles(form);
  if (files.length === 0) return back(request, `/admin/closet/${id}`, { error: "Choose at least one photo." });
  if (files.length > MAX_PHOTOS) return back(request, `/admin/closet/${id}`, { error: `Up to ${MAX_PHOTOS} photos at a time.` });
  try {
    files.forEach(validatePhoto);
  } catch (e) {
    if (e instanceof MediaError) return back(request, `/admin/closet/${id}`, { error: e.message });
    throw e;
  }
  const [{ value: last }] = await db.select({ value: max(photos.sortOrder) }).from(photos).where(eq(photos.productId, id));
  const saved: string[] = [];
  try {
    for (const file of files) saved.push(await savePhoto(file, `closet/${id}`));
    await db.insert(photos).values(saved.map((storagePath, i) => ({ productId: id, storagePath, alt: product.title, sortOrder: (last ?? -1) + 1 + i })));
  } catch (e) {
    await Promise.all(saved.map(deleteMedia));
    throw e;
  }
  return back(request, `/admin/closet/${id}`, { ok: `${saved.length} photo(s) uploaded.` });
});
