import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { affiliateItems } from "@/lib/db/schema";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { planSortOrder } from "@/lib/admin/affiliate-catalog";

export const POST = adminForm("/admin/affiliate", async ({ request, form }) => {
  const ids = form.getAll("ids").map(String);
  const existing = await db.select({ id: affiliateItems.id }).from(affiliateItems).orderBy(asc(affiliateItems.sortOrder), asc(affiliateItems.title));
  const plan = planSortOrder(existing.map((row) => row.id), ids);
  if (!plan.ok) throw new AdminInputError(plan.error);
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const row of plan.rows) {
      await tx.update(affiliateItems).set({ sortOrder: row.sortOrder, updatedAt: now }).where(eq(affiliateItems.id, row.id));
    }
  });
  if ((request.headers.get("accept") ?? "").includes("application/json")) return NextResponse.json({ ok: true });
  return back(request, "/admin/affiliate", { ok: "Order saved." });
});
