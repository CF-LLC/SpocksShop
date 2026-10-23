import { db } from "@/lib/db";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { getMailer } from "@/lib/mail";
import { getShippo } from "@/lib/shipping";
import { buyLabel, getRates, parseParcel } from "@/lib/shipping/service";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Get USPS rates or buy a label. Admin session required (adminForm + middleware). Labels are bought only here. */
export const POST = adminForm<Ctx>("/admin/orders", async ({ request, form, context, session }) => {
  const { id } = await context.params;
  if (!UUID.test(id)) throw new AdminInputError("Order not found.");
  const path = `/admin/orders/${id}`;
  const deps = { db, shippo: getShippo(), mailer: getMailer() };
  const intent = String(form.get("intent") ?? "");
  if (intent === "rates") {
    const parcel = parseParcel(Object.fromEntries(form));
    if (!parcel) return back(request, path, { error: "Enter the box size (inches, up to 108) and weight (lb, up to 70)." });
    const r = await getRates(deps, id, parcel);
    return back(request, path, r.ok ? { ok: `Got ${r.quote.rates.length} USPS rates. Pick one and buy the label.` } : { error: r.error });
  }
  if (intent === "buy") {
    if (form.get("confirm") !== "yes") return back(request, path, { error: "Tick the confirm box to buy the label." });
    const rateId = String(form.get("rate") ?? "");
    if (!rateId) return back(request, path, { error: "Pick a rate first." });
    const r = await buyLabel(deps, id, rateId, session.userId ?? null);
    if (r.ok) return back(request, path, { ok: `Label bought. Tracking ${r.trackingNumber}. Order marked shipped.${r.emailed ? " Buyer emailed." : " Buyer email is off."}` });
    return back(request, path, r.duplicate ? { ok: r.error } : { error: r.error });
  }
  throw new AdminInputError("Unknown action.");
});
