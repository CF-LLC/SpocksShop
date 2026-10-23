import { db } from "@/lib/db";
import { adminForm, back } from "@/lib/admin/http";
import { saveShipFrom, shipFromSchema } from "@/lib/shipping/ship-from";

/** Save the signed-in admin's own return address. Never logs the values. */
export const POST = adminForm("/admin/settings", async ({ request, form, session }) => {
  const parsed = shipFromSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return back(request, "/admin/settings", { error: parsed.error.issues[0]?.message ?? "Check the address." });
  await saveShipFrom(db, { userId: session.userId }, parsed.data);
  return back(request, "/admin/settings", { ok: "Return address saved." });
});
