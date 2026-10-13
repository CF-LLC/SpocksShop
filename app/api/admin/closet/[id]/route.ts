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

  const intent = String(form.get("intent") ?? "save");
  if (intent === "publish" || intent === "unpublish") {
    if (intent === "publish") {
      const [row] = await db.select({ price: products.priceCents, onHand: inventory.quantityOnHand, reserved: inventory.quantityReserved }).from(products).leftJoin(inventory, eq(inventory.productId, products.id)).where(where);
      if (!row || row.price <= 0) throw new AdminInputError("Set a price before publishing.");
      if ((row.onHand ?? 0) - (row.reserved ?? 0) <= 0) throw new AdminInputError("Set quantity on hand to at least 1 before publishing.");
    }
    await db.update(products).set({ status: intent === "publish" ? "listed" : "draft", updatedAt: new Date() }).where(where);
    const to = String(form.get("return") ?? "") === "list" ? "/admin/closet" : `/admin/closet/${id}`;
    return back(request, to, { ok: intent === "publish" ? "Published: it's live in the shop." : "Unpublished: hidden from the shop." });
  }

  if (intent === "delete") {
    // Second step of the two-step delete: the confirm form must send confirm=delete.
    if (form.get("confirm") !== "delete") return back(request, `/admin/closet/${id}`, { error: "Delete not confirmed." });
    const [inv] = await db.select({ reserved: inventory.quantityReserved }).from(inventory).where(eq(inventory.productId, id));
    if ((inv?.reserved ?? 0) > 0) throw new AdminInputError("This item is in an open checkout. Wait for it to finish or expire before deleting.");
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
