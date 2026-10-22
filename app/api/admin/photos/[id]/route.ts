import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { reorder } from "@/lib/admin/forms";
import { NextResponse } from "next/server";
import { MediaError, deleteMedia, photoFiles, savePhoto } from "@/lib/media";

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminForm<Ctx>("/admin/closet", async ({ request, form, context }) => {
  const { id } = await context.params;
  const [photo] = await db.select().from(photos).where(eq(photos.id, id));
  if (!photo || !photo.productId) throw new AdminInputError("Photo not found.");
  const page = `/admin/closet/${photo.productId}`;
  const intent = String(form.get("intent") ?? "");

  if (intent === "delete") {
    await db.delete(photos).where(eq(photos.id, id));
    await deleteMedia(photo.storagePath);
    if (photo.originalStoragePath) await deleteMedia(photo.originalStoragePath);
    return back(request, page, { ok: "Photo deleted." });
  }
  // Replace the photo with a background-removed cut-out made in the admin's browser; keep the original.
  if (intent === "cutout") {
    const json = (request.headers.get("accept") ?? "").includes("application/json");
    const fail = (error: string) => (json ? NextResponse.json({ error }, { status: 400 }) : back(request, page, { error }));
    const [file] = photoFiles(form, "photo");
    if (!file) return fail("No cut-out image was sent.");
    let saved: string;
    try {
      saved = await savePhoto(file, `closet/${photo.productId}`);
    } catch (e) {
      if (e instanceof MediaError) return fail(e.message);
      throw e;
    }
    const keep = photo.originalStoragePath ?? photo.storagePath;
    await db.update(photos).set({ storagePath: saved, originalStoragePath: keep }).where(eq(photos.id, id));
    // A previous cut-out (not the original) is no longer needed.
    if (photo.originalStoragePath) await deleteMedia(photo.storagePath);
    return json ? NextResponse.json({ ok: "Background removed." }) : back(request, page, { ok: "Background removed." });
  }
  if (intent === "revert") {
    if (!photo.originalStoragePath) throw new AdminInputError("This photo is already the original.");
    await db.update(photos).set({ storagePath: photo.originalStoragePath, originalStoragePath: null }).where(eq(photos.id, id));
    await deleteMedia(photo.storagePath);
    return back(request, page, { ok: "Original photo restored." });
  }
  if (intent !== "up" && intent !== "down") throw new AdminInputError("Unknown action.");

  const siblings = await db.select({ id: photos.id }).from(photos).where(eq(photos.productId, photo.productId)).orderBy(asc(photos.sortOrder), asc(photos.createdAt));
  const ordered = reorder(siblings, siblings.findIndex((s) => s.id === id), intent);
  await db.transaction(async (tx) => {
    for (const [i, row] of ordered.entries()) await tx.update(photos).set({ sortOrder: i }).where(eq(photos.id, row.id));
  });
  return back(request, page);
});
