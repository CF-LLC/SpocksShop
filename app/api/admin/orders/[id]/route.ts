import { db } from "@/lib/db";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { acceptOrder, declineOrder } from "@/lib/approval/service";
import type { ApprovalResult } from "@/lib/approval/core";
import { getMailer } from "@/lib/mail";
import { getStripe } from "@/lib/stripe";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const messages: Record<ApprovalResult, { ok?: string; error?: string }> = {
  updated: {},
  duplicate: { ok: "Already done. Nothing changed." },
  not_found: { error: "Order not found." },
  not_awaiting: { error: "This order isn't waiting for approval." },
  conflict: { error: "Item is no longer available." },
  stripe_error: { error: "Stripe didn't confirm it. Nothing changed; try again." },
  payment_processing: { error: "The buyer's bank payment is still settling (can take a few days). Try again once it clears." },
  stripe_unavailable: { error: "Stripe isn't configured (STRIPE_SECRET_KEY), so holds can't be captured or released." },
};

/** Accept (capture) or decline (void) an order awaiting approval. Admin session required (adminForm + middleware). */
export const POST = adminForm<Ctx>("/admin/orders", async ({ request, form, context }) => {
  const { id } = await context.params;
  if (!UUID.test(id)) throw new AdminInputError("Order not found.");
  const intent = String(form.get("intent") ?? "");
  // Not flag-gated: open holds must stay resolvable even after checkout is switched off.
  const deps = { db, stripe: getStripe(), mailer: getMailer() };
  let result: ApprovalResult;
  if (intent === "accept") result = await acceptOrder(deps, id);
  else if (intent === "decline") result = await declineOrder(deps, id, { kind: "declined", reason: String(form.get("reason") ?? "").trim() || undefined });
  else throw new AdminInputError("Unknown action.");
  const msg = result === "updated" ? { ok: intent === "accept" ? "Accepted: payment captured (or already captured), buyer emailed." : "Declined: hold released or payment fully refunded, item back in the shop, buyer emailed." } : messages[result];
  return back(request, "/admin/orders", msg);
});
