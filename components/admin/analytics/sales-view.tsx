import Link from "next/link";
import { SURFACE_LABEL, type SalesData } from "@/lib/analytics/sales";
import { AnalyticsTabs, Stat, TopList } from "./charts";

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SalesView({ data }: { data: SalesData }) {
  const { closet, drop } = data;
  const maxDay = Math.max(1, ...data.byDay.map((d) => d.revenueCents));
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold">Sales</h1>
      <AnalyticsTabs active="sales" />
      <p className="text-sm text-slate-600">Last {data.days} days. Paid orders only (not pending, held for approval, declined or canceled). Admin test drop orders excluded.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="sales-stats">
        <Stat label="Orders" value={closet.orders + drop.orders} sub={`${closet.orders} closet · ${drop.orders} Daily Drop`} />
        <Stat label="Revenue" value={usd(closet.revenueCents + drop.revenueCents)} sub={`${usd(closet.revenueCents)} closet · ${usd(drop.revenueCents)} drop`} />
        <Stat label="Tax collected" value={usd(closet.taxCents)} sub="Closet orders (Daily Drop tax is in Stripe)" />
        <Stat label="Refunded" value={usd(closet.refundsCents)} sub={`Shipping charged ${usd(closet.shippingCents)}`} />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="sales-by-day">
        <h2 className="font-semibold">Revenue by day</h2>
        {data.byDay.length ? (
          <ul className="mt-2 space-y-1 text-sm">{data.byDay.map((d) => (
            <li key={d.day} className="relative overflow-hidden rounded"><span className="absolute inset-y-0 left-0 bg-emerald-100" style={{ width: `${(d.revenueCents / maxDay) * 100}%` }} aria-hidden />
              <span className="relative flex justify-between px-1.5 py-0.5"><span>{d.day}</span><span>{d.orders} · <b>{usd(d.revenueCents)}</b></span></span></li>))}</ul>
        ) : <p className="mt-2 text-sm text-slate-600">No paid orders in this period yet.</p>}
      </section>
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white" data-testid="best-sellers">
        <h2 className="p-3 font-semibold">Best sellers</h2>
        {data.bestSellers.length ? (
          <table className="w-full text-sm"><thead><tr className="text-left text-slate-600"><th className="p-3">Item</th><th className="p-3 text-right">Sold</th><th className="p-3 text-right">Revenue</th></tr></thead>
            <tbody>{data.bestSellers.map((b) => <tr key={b.title} className="border-t border-slate-100"><td className="p-3">{b.title}</td><td className="p-3 text-right">{b.qty}</td><td className="p-3 text-right">{b.revenueCents ? usd(b.revenueCents) : "—"}</td></tr>)}</tbody></table>
        ) : <p className="px-3 pb-3 text-sm text-slate-600">No sales in this period yet.</p>}
      </section>
      <TopList title="Amazon click-outs by section" testId="clicks-by-surface" rows={data.clicksBySurface.map((s) => ({ key: SURFACE_LABEL[s.surface], n: s.n }))} />
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white" data-testid="clicks-by-pick">
        <h2 className="p-3 font-semibold">Affiliate clicks per pick</h2>
        <p className="px-3 text-xs text-slate-600">Counted by a first-party beacon on the existing Amazon links (bots, admins and do-not-track visitors excluded). Clicks, not Amazon purchases: earnings are in Amazon Associates.</p>
        {data.clicksByPick.length ? (
          <table className="w-full text-sm"><thead><tr className="text-left text-slate-600"><th className="p-3">Pick</th><th className="p-3 text-right">Picks</th><th className="p-3 text-right">Closet</th><th className="p-3 text-right">Drop</th><th className="p-3 text-right">Other</th><th className="p-3 text-right">Total</th></tr></thead>
            <tbody>{data.clicksByPick.map((p) => <tr key={p.asin} className="border-t border-slate-100"><td className="p-3">{p.title ?? (p.asin === "LINK" ? "Amazon link (no ASIN)" : p.asin)}</td><td className="p-3 text-right">{p.picks}</td><td className="p-3 text-right">{p.closet}</td><td className="p-3 text-right">{p.drop}</td><td className="p-3 text-right">{p.other}</td><td className="p-3 text-right font-semibold">{p.n}</td></tr>)}</tbody></table>
        ) : <p className="px-3 pb-3 text-sm text-slate-600">No Amazon click-outs in this period yet.</p>}
      </section>
      <p className="text-sm"><Link href="/admin/orders" className="text-blue-700 underline">Open orders</Link> · <Link href="/admin/affiliate" className="text-blue-700 underline">Amazon Picks</Link></p>
    </section>
  );
}
