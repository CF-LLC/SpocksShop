import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AdminNotice } from "@/components/admin/notice";
import { db } from "@/lib/db";
import { addresses, orderItems, orders } from "@/lib/db/schema";
import { formatCents } from "@/lib/commerce/money";
import { SHIPPABLE_STATUSES, shipFrom, shippoMode, trackingEmailEnabled } from "@/lib/shipping/config";
import { labelsFor, NOT_CONFIGURED, type StoredQuote } from "@/lib/shipping/service";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d) + " CT" : "—");

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [row] = await db.select({ o: orders, a: addresses }).from(orders).leftJoin(addresses, eq(addresses.id, orders.shippingAddressId)).where(eq(orders.id, id));
  if (!row) notFound();
  const { o, a } = row;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const labels = await labelsFor(db, id);
  const bought = labels.find((l) => l.status === "purchased");
  const mode = shippoMode();
  const from = shipFrom();
  const quote = o.shippingQuote as StoredQuote | null;
  const shippable = (SHIPPABLE_STATUSES as readonly string[]).includes(o.status);
  const weight = quote?.parcel.weightLb ?? "";

  return (
    <section className="space-y-6">
      <Link href="/admin/orders" className="text-sm underline">← All orders</Link>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-mono text-2xl font-semibold">{o.orderNumber}</h1>
        <span className="text-lg font-semibold">{formatCents(o.totalCents)} · {o.status}</span>
      </div>
      <AdminNotice {...await searchParams} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-2xl border border-slate-200 p-4">
          <h2 className="font-semibold">Items</h2>
          <ul className="text-sm">{items.map((i) => <li key={i.id}>{i.titleSnapshot}{i.quantity > 1 ? ` ×${i.quantity}` : ""} · {formatCents(i.unitPriceCents)}</li>)}</ul>
          <h2 className="pt-2 font-semibold">Ship to</h2>
          {a ? (
            <address className="text-sm not-italic" data-testid="ship-to">{a.name}<br />{a.line1}{a.line2 ? <><br />{a.line2}</> : null}<br />{a.city}, {a.state} {a.postalCode}</address>
          ) : <p className="text-sm text-slate-600">No shipping address on file.</p>}
          <p className="text-xs text-slate-600">Buyer: {o.customerEmail ?? "—"} · Paid shipping: {formatCents(o.shippingCents)}</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4" data-testid="shipping-panel">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">USPS label</h2>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs" data-testid="shippo-mode">{mode === "not_configured" ? "Shippo: not configured" : mode === "test" ? "Shippo: TEST mode" : "Shippo: live"}</span>
          </div>
          {mode === "not_configured" ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900" data-testid="shippo-not-configured">{NOT_CONFIGURED}</p> : null}
          {!from.ok ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900" data-testid="shipfrom-missing">Return address not set: {from.missing.join(", ")}. Label purchase is blocked until it is.</p> : <p className="text-xs text-slate-600">Ships from: {from.address.city}, {from.address.state} {from.address.zip}</p>}

          {o.trackingNumber ? (
            <div className="space-y-2" data-testid="tracking">
              <p className="text-sm">Shipped {when(o.shippedAt)} · {o.trackingCarrier} <a className="font-mono underline" href={o.trackingUrl ?? "#"} target="_blank" rel="noreferrer">{o.trackingNumber}</a></p>
              {bought?.labelUrl ? (
                <>
                  <a className="btn btn-primary" href={bought.labelUrl} target="_blank" rel="noreferrer" data-testid="label-pdf">Open / print label PDF</a>
                  <iframe title="Shipping label" src={bought.labelUrl} className="h-96 w-full rounded-lg border bg-white" />
                </>
              ) : null}
              <p className="text-xs text-slate-600">Buyer tracking email: {o.trackingEmailSentAt ? `sent ${when(o.trackingEmailSentAt)}` : trackingEmailEnabled() ? "not sent" : "off (SHIPPING_TRACKING_EMAIL_ENABLED)"}</p>
            </div>
          ) : !shippable ? (
            <p className="text-sm text-slate-600">Labels can be bought once the order is paid.</p>
          ) : (
            <>
              <form action={`/api/admin/orders/${o.id}/shipping`} method="post" className="grid grid-cols-4 gap-2 text-sm">
                <input type="hidden" name="intent" value="rates" />
                {[["length", "L in", quote?.parcel.lengthIn ?? 10], ["width", "W in", quote?.parcel.widthIn ?? 8], ["height", "H in", quote?.parcel.heightIn ?? 4], ["weight", "lb", weight]].map(([n, l, v]) => (
                  <label key={String(n)} className="space-y-1"><span className="block text-xs">{l}</span><input name={String(n)} defaultValue={String(v)} inputMode="decimal" required className="field-input w-full" /></label>
                ))}
                <button type="submit" className="btn btn-outline col-span-4" disabled={mode === "not_configured" || !from.ok} data-testid="get-rates">Get USPS rates</button>
              </form>
              {quote?.rates.length ? (
                <form action={`/api/admin/orders/${o.id}/shipping`} method="post" className="space-y-2" data-testid="rates">
                  <input type="hidden" name="intent" value="buy" />
                  {quote.rates.map((r, n) => (
                    <label key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white p-2 text-sm">
                      <span><input type="radio" name="rate" value={r.id} defaultChecked={n === 0} className="mr-2" />{r.carrier} {r.service}{r.days ? ` · ${r.days} day${r.days > 1 ? "s" : ""}` : ""}</span>
                      <span className="font-semibold">{formatCents(r.amountCents)}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> I confirm: buy this label (charges the Shippo account)</label>
                  <button type="submit" className="btn btn-primary w-full" disabled={mode === "not_configured" || !from.ok} data-testid="buy-label">Buy USPS label</button>
                  <p className="text-xs text-slate-600">Rates fetched {when(new Date(quote.fetchedAt))}. One label per order; a second click won&apos;t buy again.</p>
                </form>
              ) : null}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
