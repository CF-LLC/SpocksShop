import { count, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photos, products } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { MAX_PHOTOS, MAX_PHOTOS_PER_PRODUCT, MediaError, deleteMedia, photoFiles, savePhoto, validatePhoto } from "@/lib/media";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Upload photos for a closet item. Plain form posts get a redirect; the in-page uploader sends
 * `accept: application/json` (one photo per request, which keeps each body small) and gets JSON back.
 */
export const POST = adminForm<Ctx>("/admin/closet", async ({ request, form, context }) => {
  const { id } = await context.params;
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  const page = `/admin/closet/${id}`;
  const fail = (error: string, status = 400) => (wantsJson ? NextResponse.json({ error }, { status }) : back(request, page, { error }));

  const [product] = await db.select({ id: products.id, title: products.title }).from(products).where(eq(products.id, id));
  if (!product) throw new AdminInputError("Item not found.");
  const files = photoFiles(form);
  if (files.length === 0) return fail("Choose at least one photo.");
  if (files.length > MAX_PHOTOS) return fail(`Up to ${MAX_PHOTOS} photos at a time.`);
  const [{ value: existing }] = await db.select({ value: count() }).from(photos).where(eq(photos.productId, id));
  if (existing + files.length > MAX_PHOTOS_PER_PRODUCT) return fail(`An item can have up to ${MAX_PHOTOS_PER_PRODUCT} photos (it has ${existing}).`);
  try {
    files.forEach(validatePhoto);
  } catch (e) {
    if (e instanceof MediaError) return fail(e.message);
    throw e;
  }
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200) || product.title;
  const [{ value: last }] = await db.select({ value: max(photos.sortOrder) }).from(photos).where(eq(photos.productId, id));
  const saved: string[] = [];
  try {
    for (const file of files) saved.push(await savePhoto(file, `closet/${id}`));
    await db.insert(photos).values(saved.map((storagePath, i) => ({ productId: id, storagePath, alt, sortOrder: (last ?? -1) + 1 + i })));
  } catch (e) {
    await Promise.all(saved.map(deleteMedia));
    if (e instanceof MediaError) return fail(e.message);
    throw e;
  }
  const ok = `${saved.length} photo${saved.length === 1 ? "" : "s"} uploaded.`;
  return wantsJson ? NextResponse.json({ ok, saved: saved.length }) : back(request, page, { ok });
});
