import { db } from "@/lib/db";
import { affiliateItems } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { affiliateItemSchema } from "@/lib/admin/forms";

export const POST = adminForm("/admin/affiliate", async ({ request, form }) => {
  const parsed = affiliateItemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new AdminInputError(parsed.error.issues[0]?.message ?? "Invalid input");
  await db.insert(affiliateItems).values(parsed.data);
  return back(request, "/admin/affiliate", { ok: "Amazon pick added." });
});
