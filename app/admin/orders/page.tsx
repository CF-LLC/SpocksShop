import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { formatCents } from "@/lib/commerce/money";
import { OPEN_APPROVAL_STATUSES } from "@/lib/approval/core";
import { stripeSettings } from "@/lib/stripe";

const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d) + " CT" : "—");

function timeLeft(expires: Date | null, now: Date) {
  if (!expires) return "—";
  const ms = expires.getTime() - now.getTime();
  if (ms <= 0) return "expiring now";
  const h = Math.floor(ms / 3600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h left`;
}

const statusLabel: Record<string, string> = {
  awaiting_approval: "Awaiting approval", capturing: "Charging…", declining: "Releasing…", paid: "Paid", paid_review: "Paid (review)",
  declined: "Declined", hold_expired: "Auto-canceled", canceled: "Canceled", pending: "In checkout", processing: "Processing", shipped: "Shipped",
};

export default async function AdminOrdersPage({ searchParams }: { searchParams: NoticeParams }) {
  const now = new Date();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200);
  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db.select({ orderId: orderItems.orderId, title: orderItems.titleSnapshot, qty: orderItems.quantity, productId: orderItems.productId, slug: products.slug }).from(orderItems).leftJoin(products, eq(products.id, orderItems.productId)).where(inArray(orderItems.orderId, ids))
    : [];
  const itemsOf = (id: string) => items.filter((i) => i.orderId === id);
  const queue = rows.filter((r) => (OPEN_APPROVAL_STATUSES as readonly string[]).includes(r.status)).sort((a, b) => (a.holdExpiresAt?.getTime() ?? 0) - (b.holdExpiresAt?.getTime() ?? 0));
  const rest = rows.filter((r) => !queue.includes(r));
  const checkoutOn = stripeSettings().checkoutEnabled;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-600">
          {checkoutOn ? "Website checkout is on." : "Website checkout is off (STRIPE_CHECKOUT_ENABLED)."} Items that require approval are held at checkout when the payment method allows it (cards, Apple/Google Pay, Link, Klarna, Affirm, Afterpay, Cash App Pay, Amazon Pay); crypto and bank payments are charged right away. Accept captures the hold (or just confirms a captured payment); Decline releases the hold or refunds in full. Orders auto-cancel after 6 days.
        </p>
      </div>
      <AdminNotice {...await searchParams} />

      <section aria-labelledby="queue-title" className="space-y-3" data-testid="approval-queue">
        <h2 id="queue-title" className="text-lg font-semibold">Waiting for you <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-900">{queue.length}</span></h2>
        {queue.length === 0 ? <p className="text-sm text-slate-600">Nothing to approve.</p> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {queue.map((o) => (
              <li key={o.id} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="approval-card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm font-semibold underline">{o.orderNumber}</Link>
                  <span className="text-lg font-semibold">{formatCents(o.totalCents)}</span>
                </div>
                <ul className="text-sm">
                  {itemsOf(o.id).map((i, n) => (
                    <li key={n}>{i.slug ? <Link className="underline" href={`/admin/closet/${i.productId}`}>{i.title}</Link> : i.title}{i.qty > 1 ? ` ×${i.qty}` : ""}</li>
                  ))}
                </ul>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
                  <dt>Buyer</dt><dd className="truncate">{o.customerEmail ?? "—"}</dd>
                  <dt>Fulfillment</dt><dd>{o.fulfillmentMethod ?? "—"}</dd>
                  <dt>Authorized</dt><dd>{when(o.authorizedAt)}</dd>
                  <dt>Auto-cancels</dt><dd className="font-semibold text-amber-900">{when(o.holdExpiresAt)} · {timeLeft(o.holdExpiresAt, now)}</dd>
                  {o.status !== "awaiting_approval" ? (<><dt>State</dt><dd>{statusLabel[o.status]} (retry is safe)</dd></>) : null}
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <form action={`/api/admin/orders/${o.id}`} method="post">
                    <input type="hidden" name="intent" value="accept" />
                    <button type="submit" className="btn btn-primary w-full" data-testid="accept">Accept &amp; charge</button>
                  </form>
                  <details className="group">
                    <summary className="btn btn-outline w-full cursor-pointer list-none text-red-700" data-testid="decline">Decline…</summary>
                    <form action={`/api/admin/orders/${o.id}`} method="post" className="mt-2 space-y-2">
                      <input type="hidden" name="intent" value="decline" />
                      <input name="reason" maxLength={500} placeholder="Reason (optional, internal)" className="field-input w-full text-sm" />
                      <button type="submit" className="btn w-full border-red-700 bg-red-700 text-white">Release hold</button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="all-title" className="space-y-3">
        <h2 id="all-title" className="text-lg font-semibold">All orders</h2>
        {rest.length === 0 ? <p className="text-sm text-slate-600">No orders yet.</p> : (
          <>
            <ul className="space-y-2 sm:hidden">
              {rest.map((r) => (
                <li key={r.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex justify-between"><Link href={`/admin/orders/${r.id}`} className="font-mono underline">{r.orderNumber}</Link><span>{formatCents(r.totalCents)}</span></div>
                  <div className="text-slate-600">{statusLabel[r.status] ?? r.status} · {r.salesChannel}</div>
                </li>
              ))}
            </ul>
            <table className="hidden min-w-full text-left text-sm sm:table">
              <thead><tr><th className="p-2">Number</th><th className="p-2">Channel</th><th className="p-2">Status</th><th className="p-2">Decided</th><th className="p-2">Total</th></tr></thead>
              <tbody>
                {rest.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2 font-mono"><Link className="underline" href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link></td>
                    <td className="p-2">{row.salesChannel}</td>
                    <td className="p-2">{statusLabel[row.status] ?? row.status}</td>
                    <td className="p-2">{when(row.decidedAt)}</td>
                    <td className="p-2">{formatCents(row.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </section>
  );
}
