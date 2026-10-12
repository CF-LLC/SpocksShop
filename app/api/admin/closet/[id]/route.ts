import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventory, photos, products } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { parseClosetForm } from "@/lib/admin/forms";
import { isUniqueViolation } from "@/lib/admin/db-errors";
import { deleteMedia } from "@/lib/media";

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminForm<Ctx>("/admin/closet", async ({ request, form, context }) => {
  const { id } = await context.params;
  const where = and(eq(products.id, id), eq(products.source, "closet"));
  const [existing] = await db.select({ id: products.id }).from(products).where(where);
  if (!existing) throw new AdminInputError("Item not found.");

  if (form.get("intent") === "delete") {
    const files = await db.select({ path: photos.storagePath }).from(photos).where(eq(photos.productId, id));
    await db.delete(products).where(where);
    await Promise.all(files.map((f) => deleteMedia(f.path)));
    return back(request, "/admin/closet", { ok: "Item deleted." });
  }

  const { product, quantity } = parseClosetForm(form);
  try {
    await db.transaction(async (tx) => {
      await tx.update(products).set({ ...product, updatedAt: new Date() }).where(where);
      const [inv] = await tx.select().from(inventory).where(eq(inventory.productId, id));
      if (!inv) await tx.insert(inventory).values({ productId: id, quantityOnHand: quantity });
      else {
        if (quantity < inv.quantityReserved) throw new AdminInputError(`Quantity can't go below ${inv.quantityReserved} reserved.`);
        await tx.update(inventory).set({ quantityOnHand: quantity, updatedAt: new Date() }).where(eq(inventory.productId, id));
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AdminInputError("SKU or slug already in use.");
    throw e;
  }
  return back(request, `/admin/closet/${id}`, { ok: "Saved." });
});
