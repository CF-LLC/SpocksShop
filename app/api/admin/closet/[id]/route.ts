import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventory, products } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { parseClosetForm } from "@/lib/admin/forms";
import { isUniqueViolation } from "@/lib/admin/db-errors";
import { NextResponse } from "next/server";
import { applyBulk } from "@/lib/admin/closet-manage";
import { publicUrl } from "@/lib/public-url";

const safeReturn = (v: FormDataEntryValue | null) => { const s = typeof v === "string" ? v : ""; return /^\/admin\/closet(\/|\?|$)/.test(s) && !s.includes("//") ? s : "/admin/closet"; };

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminForm<Ctx>("/admin/closet", async ({ request, form, context }) => {
  const { id } = await context.params;
  const where = and(eq(products.id, id), eq(products.source, "closet"));
  const [existing] = await db.select({ id: products.id, status: products.status }).from(products).where(where);
  if (!existing) throw new AdminInputError("Item not found.");

  const intent = String(form.get("intent") ?? "save");
  if (existing.status === "trashed") throw new AdminInputError("That item is in Trash. Restore it first.");
  if (intent === "publish" || intent === "unpublish") {
    if (intent === "publish") {
      const [row] = await db.select({ price: products.priceCents, onHand: inventory.quantityOnHand, reserved: inventory.quantityReserved }).from(products).leftJoin(inventory, eq(inventory.productId, products.id)).where(where);
      if (!row || row.price <= 0) throw new AdminInputError("Set a price before publishing.");
      if ((row.onHand ?? 0) - (row.reserved ?? 0) <= 0) throw new AdminInputError("Set quantity on hand to at least 1 before publishing.");
    }
    await db.update(products).set({ status: intent === "publish" ? "listed" : "draft", updatedAt: new Date() }).where(where);
    const ret = String(form.get("return") ?? "");
    const to = ret === "list" ? "/admin/closet" : ret.startsWith("/admin/closet") ? safeReturn(ret) : `/admin/closet/${id}`;
    return back(request, to, { ok: intent === "publish" ? "Published: it's live in the shop." : "Unpublished: hidden from the shop." });
  }

  if (intent === "delete" || intent === "trash") {
    // Delete now means "move to Trash" (undo/restore from the list); only Empty trash purges.
    const plan = await applyBulk("trash", [id]);
    if (!plan.ok.length) throw new AdminInputError(`Couldn't move it to Trash: ${plan.skipped[0]?.reason ?? "unknown"}.`);
    const url = publicUrl(request, "/admin/closet");
    url.searchParams.set("ok", "Moved to Trash."); url.searchParams.set("undo", id);
    return NextResponse.redirect(url, 303);
  }

  if (intent === "quick") {
    // Inline edit from the list: title and price only.
    const title = String(form.get("title") ?? "").trim().slice(0, 160);
    const price = Number(String(form.get("price") ?? "").replace(/[^0-9.]/g, ""));
    if (title.length < 2) throw new AdminInputError("Title is too short.");
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) throw new AdminInputError("Enter a valid price.");
    await db.update(products).set({ title, priceCents: Math.round(price * 100), updatedAt: new Date() }).where(where);
    return back(request, safeReturn(form.get("return")), { ok: "Saved." });
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
