import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateItems } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { affiliateItemSchema } from "@/lib/admin/forms";

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminForm<Ctx>("/admin/affiliate", async ({ request, form, context }) => {
  const { id } = await context.params;
  if (form.get("intent") === "delete") {
    await db.delete(affiliateItems).where(eq(affiliateItems.id, id));
    return back(request, "/admin/affiliate", { ok: "Deleted." });
  }
  const parsed = affiliateItemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new AdminInputError(parsed.error.issues[0]?.message ?? "Invalid input");
  const updated = await db
    .update(affiliateItems)
    .set({ imageUrl: null, amazonUrl: null, asin: null, priceNote: null, ...parsed.data, updatedAt: new Date() })
    .where(eq(affiliateItems.id, id))
    .returning({ id: affiliateItems.id });
  if (updated.length === 0) throw new AdminInputError("Item not found.");
  return back(request, "/admin/affiliate", { ok: "Saved." });
});
