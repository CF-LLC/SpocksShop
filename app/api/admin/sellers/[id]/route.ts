import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sellers } from "@/lib/db/schema";
import { adminForm, AdminInputError, back } from "@/lib/admin/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminForm<Ctx>("/admin/sellers", async ({ request, form, context }) => {
  const { id } = await context.params;
  const intent = form.get("intent");
  const status = intent === "activate" ? "active" : intent === "suspend" ? "suspended" : null;
  if (!status) throw new AdminInputError("Unknown action.");
  const updated = await db.update(sellers).set({ status, updatedAt: new Date() }).where(eq(sellers.id, id)).returning({ name: sellers.displayName });
  if (updated.length === 0) throw new AdminInputError("Seller not found.");
  return back(request, "/admin/sellers", { ok: `${updated[0].name} is now ${status}.` });
});
