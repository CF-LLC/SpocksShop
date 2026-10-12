import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { reorder } from "@/lib/admin/forms";
import { deleteMedia } from "@/lib/media";

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
    return back(request, page, { ok: "Photo deleted." });
  }
  if (intent !== "up" && intent !== "down") throw new AdminInputError("Unknown action.");

  const siblings = await db.select({ id: photos.id }).from(photos).where(eq(photos.productId, photo.productId)).orderBy(asc(photos.sortOrder), asc(photos.createdAt));
  const ordered = reorder(siblings, siblings.findIndex((s) => s.id === id), intent);
  await db.transaction(async (tx) => {
    for (const [i, row] of ordered.entries()) await tx.update(photos).set({ sortOrder: i }).where(eq(photos.id, row.id));
  });
  return back(request, page);
});
