import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inventory, products } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { parseClosetForm } from "@/lib/admin/forms";
import { isUniqueViolation } from "@/lib/admin/db-errors";

const wantsJson = (r: Request) => (r.headers.get("accept") ?? "").includes("application/json");

export const POST = adminForm("/admin/closet/new", async ({ request, form }) => {
  const json = wantsJson(request);
  try {
    const { product, quantity } = parseClosetForm(form);
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(products).values(product).returning({ id: products.id });
      await tx.insert(inventory).values({ productId: row.id, quantityOnHand: quantity });
      return row.id;
    });
    // The photo-first flow posts with Accept: application/json, then uploads its photos to /photos.
    if (json) return NextResponse.json({ id }, { status: 201 });
    return back(request, `/admin/closet/${id}`, { ok: "Item created. Add photos below." });
  } catch (e) {
    const err = isUniqueViolation(e) ? new AdminInputError("SKU or slug already in use.") : e;
    if (json && err instanceof AdminInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
});
