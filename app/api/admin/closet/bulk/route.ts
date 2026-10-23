import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { AdminInputError, adminForm } from "@/lib/admin/http";
import { TRASHED, applyBulk, isBulkAction, summarize } from "@/lib/admin/closet-manage";
import { publicUrl } from "@/lib/public-url";

const UUID = /^[0-9a-f-]{36}$/i;

/** Only return to a Closet admin page (no open redirects). */
function returnPath(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return /^\/admin\/closet(\/|\?|$)/.test(s) && !s.includes("//") ? s.slice(0, 500) : "/admin/closet";
}

export const POST = adminForm("/admin/closet", async ({ request, form }) => {
  const action = form.get("action");
  if (!isBulkAction(action)) throw new AdminInputError("Unknown action.");
  let ids = form.getAll("ids").map(String).filter((s) => UUID.test(s));
  if (action === "purge") {
    if (form.get("confirm") !== "purge") throw new AdminInputError("Permanent delete not confirmed.");
    if (form.get("all") === "trash") ids = (await db.select({ id: products.id }).from(products).where(and(eq(products.source, "closet"), eq(products.status, TRASHED)))).map((r) => r.id);
  }
  if (!ids.length) throw new AdminInputError("Select at least one item.");
  const plan = await applyBulk(action, ids);
  const url = publicUrl(request, returnPath(form.get("return")));
  url.searchParams.delete("ok"); url.searchParams.delete("error"); url.searchParams.delete("undo");
  url.searchParams.set(plan.ok.length ? "ok" : "error", plan.ok.length ? summarize(action, plan) : `Nothing changed: ${summarize(action, plan)}`);
  if (action === "trash" && plan.ok.length) url.searchParams.set("undo", plan.ok.map((p) => p.id).join(","));
  return NextResponse.redirect(url, 303);
});
