import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateItems } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { affiliateItemSchema, affiliateItemWrite } from "@/lib/admin/forms";

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminForm<Ctx>("/admin/affiliate", async ({ request, form, context }) => {
  const { id } = await context.params;
  const intent = form.get("intent");
  if (intent === "delete") {
    if (form.get("confirm") !== "yes") throw new AdminInputError("Confirm the delete, or hide the pick instead.");
    await db.delete(affiliateItems).where(eq(affiliateItems.id, id));
    return back(request, "/admin/affiliate", { ok: "Deleted." });
  }
  if (intent === "hide") {
    const updated = await db
      .update(affiliateItems)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(affiliateItems.id, id))
      .returning({ id: affiliateItems.id });
    if (updated.length === 0) throw new AdminInputError("Item not found.");
    return back(request, "/admin/affiliate", { ok: "Hidden. It stays in the catalog and can be turned back on." });
  }
  const parsed = affiliateItemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new AdminInputError(parsed.error.issues[0]?.message ?? "Invalid input");
  // The editor omits sortOrder so a save cannot clobber a drag-reorder that happened beside an open form.
  let sortOrder = affiliateItemWrite(parsed.data).sortOrder;
  if (!form.has("sortOrder")) {
    const [row] = await db.select({ sortOrder: affiliateItems.sortOrder }).from(affiliateItems).where(eq(affiliateItems.id, id));
    if (!row) throw new AdminInputError("Item not found.");
    sortOrder = row.sortOrder;
  }
  const updated = await db
    .update(affiliateItems)
    .set({ ...affiliateItemWrite(parsed.data), sortOrder, updatedAt: new Date() })
    .where(eq(affiliateItems.id, id))
    .returning({ id: affiliateItems.id });
  if (updated.length === 0) throw new AdminInputError("Item not found.");
  return back(request, "/admin/affiliate", { ok: "Saved." });
});
