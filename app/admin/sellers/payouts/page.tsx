import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, sellerPayouts, sellers } from "@/lib/db/schema";
import { formatCents } from "@/lib/commerce/money";
import { marketplaceSettings } from "@/lib/marketplace/config";

export const dynamic = "force-dynamic";
const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d) + " CT" : "—");

export default async function AdminPayoutsPage() {
  const s = marketplaceSettings();
  const rows = await db
    .select({ p: sellerPayouts, seller: sellers.displayName, orderNumber: orders.orderNumber, shippedAt: orders.shippedAt })
    .from(sellerPayouts)
    .innerJoin(sellers, eq(sellers.id, sellerPayouts.sellerId))
    .innerJoin(orders, eq(orders.id, sellerPayouts.orderId))
    .orderBy(sql`${sellerPayouts.needsReview} desc`, desc(sellerPayouts.createdAt))
    .limit(200);
  const t = rows.reduce((a, { p }) => {
    if (p.status !== "canceled") a.fees += p.feeCents;
    if (p.status === "held" || p.status === "disputed") a.held += p.amountCents;
    if (p.status === "transferred") a.paid += p.amountCents;
    if (p.needsReview) a.review++;
    return a;
  }, { fees: 0, held: 0, paid: 0, review: 0 });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Seller fees &amp; payouts</h1><Link className="underline text-sm" href="/admin/sellers">← Sellers</Link></div>
      <p className="text-sm text-slate-600">Fee {(s.feeBps / 100).toFixed(2)}% (SELLER_FEE_BPS), min {formatCents(s.feeMinCents)} per order (SELLER_FEE_MIN_CENTS), capped at the item subtotal · payout {s.holdDaysAfterDelivery} day(s) after delivery (SELLER_PAYOUT_HOLD_DAYS) · not delivered after {s.reviewAfterShippedDays} days → review (SELLER_PAYOUT_REVIEW_DAYS). Stripe processing fees on seller sales are paid by the platform out of the fee.</p>
      <div className="grid gap-3 sm:grid-cols-4" data-testid="payout-totals">
        {[["Platform fees", formatCents(t.fees)], ["Held for sellers", formatCents(t.held)], ["Transferred", formatCents(t.paid)], ["Needs review", String(t.review)]].map(([k, v]) => (
          <div key={k} className="surface-panel rounded-xl p-3"><p className="text-xs text-slate-500">{k}</p><p className="text-lg font-semibold">{v}</p></div>
        ))}
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-500">No seller sales yet.</p> : (
        <table className="min-w-full text-left text-sm">
          <thead><tr><th className="p-2">Order</th><th className="p-2">Seller</th><th className="p-2">Items</th><th className="p-2">Fee</th><th className="p-2">Payout</th><th className="p-2">Status</th><th className="p-2">Delivered</th><th className="p-2">Releases</th><th className="p-2">Transfer</th><th className="p-2">Note</th></tr></thead>
          <tbody>
            {rows.map(({ p, seller, orderNumber }) => (
              <tr key={p.id} className={`border-t ${p.needsReview ? "bg-amber-50" : ""}`}>
                <td className="p-2"><Link className="underline" href={`/admin/orders/${p.orderId}`}>{orderNumber}</Link></td>
                <td className="p-2">{seller}</td>
                <td className="p-2">{formatCents(p.grossCents)}</td>
                <td className="p-2">{formatCents(p.feeCents)}</td>
                <td className="p-2">{formatCents(p.amountCents)}</td>
                <td className="p-2">{p.status}{p.needsReview ? " ⚠" : ""}</td>
                <td className="p-2">{when(p.deliveredAt)}{p.deliveredSource ? ` (${p.deliveredSource})` : ""}</td>
                <td className="p-2">{p.status === "held" ? when(p.releaseAfter) : "—"}</td>
                <td className="p-2 font-mono text-xs">{p.transferId ?? ""}</td>
                <td className="p-2 text-slate-600">{[p.holdReason, p.lastError].filter(Boolean).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
