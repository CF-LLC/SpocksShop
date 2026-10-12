import { db } from "@/lib/db";
import { inventory, products } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { parseClosetForm } from "@/lib/admin/forms";
import { isUniqueViolation } from "@/lib/admin/db-errors";

export const POST = adminForm("/admin/closet/new", async ({ request, form }) => {
  const { product, quantity } = parseClosetForm(form);
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(products).values(product).returning({ id: products.id });
      await tx.insert(inventory).values({ productId: row.id, quantityOnHand: quantity });
      return row.id;
    });
    return back(request, `/admin/closet/${id}`, { ok: "Item created. Add photos below." });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AdminInputError("SKU or slug already in use.");
    throw e;
  }
});
