import { adminForm, back } from "@/lib/admin/http";
import { db } from "@/lib/db";
import { markDelivered } from "@/lib/marketplace/service";

type Ctx = { params: Promise<{ id: string }> };

/** Admin confirms delivery (no tracking / tracking stuck). Starts the seller payout hold window. */
export const POST = adminForm<Ctx>("/admin/orders", async ({ request, context }) => {
  const { id } = await context.params;
  const r = await markDelivered({ db, stripe: null }, id, "admin");
  return back(request, `/admin/orders/${id}`, { ok: r === "started" ? "Marked delivered. Seller payout releases after the hold window." : "Already marked delivered." });
});
