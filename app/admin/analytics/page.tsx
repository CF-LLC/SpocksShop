import { db } from "@/lib/db";
import { EVENT_LABELS } from "@/lib/analytics/events";
import { eventCounts, firstEvent, orderFunnel, topBy, totals, trend } from "@/lib/analytics/report";
import { AnalyticsTabs, Stat, TopList, TrendChart } from "@/components/admin/analytics/charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [t1, t7, t30, tAll, points, pages, sources, ev30, ev7, orders30, amazon, first] = await Promise.all([
    totals(db, 1), totals(db, 7), totals(db, 30), totals(db, null), trend(db, 30),
    topBy(db, "path", { days: 30 }), topBy(db, "source", { days: 30 }),
    eventCounts(db, 30), eventCounts(db, 7), orderFunnel(db, 30), topBy(db, "ref", { name: "amazon_click", days: 30 }), firstEvent(db),
  ]);
  const funnel = [
    { label: EVENT_LABELS.product_view, n: ev30.product_view ?? 0 },
    { label: `${EVENT_LABELS.add_to_cart} (Closet)`, n: ev30.add_to_cart ?? 0 },
    { label: EVENT_LABELS.checkout_start, n: ev30.checkout_start ?? 0 },
    { label: "Paid orders (Closet + Daily Drop)", n: orders30.closetPaid + orders30.dropPaid },
  ];
  const fmax = Math.max(1, ...funnel.map((f) => f.n));
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">
          Counted on our own server: no cookies, no third-party scripts, no IP addresses. Visitors are a daily-rotating anonymous hash, so &quot;visitors&quot; over several days is the sum of each day&apos;s unique visitors.
          Not counted: your signed-in visits, bots and link previews, prefetches, Do-Not-Track/GPC browsers, and 404s (including held designs). Raw rows are kept 90 days, then rolled up into daily totals.
          {first ? ` Page views counted since ${new Date(first).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}.` : " Page-view counting just started."}
        </p>
      </div>
      <AnalyticsTabs active="overview" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="analytics-stats">
        <Stat label="Page views today" value={t1.views} sub={`${t1.visitors} visitors`} />
        <Stat label="Page views 7 days" value={t7.views} sub={`${t7.visitors} visitors`} />
        <Stat label="Page views 30 days" value={t30.views} sub={`${t30.visitors} visitors`} />
        <Stat label="All time" value={tAll.views} sub={`${tAll.visitors} visitors`} />
      </div>
      <TrendChart points={points} label="Daily page views, last 30 days" />
      <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="analytics-funnel">
        <h2 className="font-semibold">Shopping funnel (30 days)</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {funnel.map((f) => (
            <li key={f.label}>
              <div className="flex justify-between"><span>{f.label}</span><span className="font-semibold">{f.n}</span></div>
              <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-500" style={{ width: `${(f.n / fmax) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-slate-500">Product views, add-to-cart and checkout starts are beacon events. Daily Drop items skip the cart (Buy goes straight to checkout). Paid orders come from the orders table; Closet checkout sessions created: {orders30.closetSessions}. Last 7 days: {ev7.product_view ?? 0} product views · {ev7.add_to_cart ?? 0} add to cart · {ev7.checkout_start ?? 0} checkout starts.</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <TopList title="Top pages (30 days)" rows={pages} testId="top-pages" />
        <TopList title="Traffic sources (30 days)" rows={sources} empty="No external referrers yet (direct visits and apps that hide the referrer aren't listed)." testId="top-sources" />
        <TopList title="Amazon picks clicked (ASIN, 30 days)" rows={amazon} />
      </div>
    </section>
  );
}
