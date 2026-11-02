import Link from "next/link";
import type { Listing, OpsData } from "@/lib/admin/ops-report";
import { AnalyticsTabs, Stat } from "./charts";

function Queue({ label, n, href, note }: { label: string; n: number; href?: string; note?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-slate-100 p-3 first:border-t-0">
      <span>{href ? <Link href={href} className="text-blue-700 underline">{label}</Link> : label}{note ? <span className="block text-xs text-slate-600">{note}</span> : null}</span>
      <span className={`text-lg font-semibold ${n ? "text-amber-700" : "text-slate-500"}`}>{n}</span>
    </li>
  );
}

function Listings({ title, rows, empty, testId }: { title: string; rows: Listing[]; empty: string; testId: string }) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white" data-testid={testId}>
      <h2 className="p-3 font-semibold">{title}</h2>
      {rows.length ? (
        <table className="w-full text-sm"><thead><tr className="text-left text-slate-600"><th className="p-3">Item</th><th className="p-3 text-right">Available</th><th className="p-3 text-right">Listed</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="p-3"><Link href={r.source === "community" ? "/admin/community" : `/admin/closet/${r.id}`} className="text-blue-700 underline">{r.title}</Link> <span className="text-xs text-slate-500">{r.sku}</span></td><td className="p-3 text-right">{r.available}</td><td className="p-3 text-right">{r.ageDays}d ago</td></tr>)}</tbody></table>
      ) : <p className="px-3 pb-3 text-sm text-slate-600">{empty}</p>}
    </section>
  );
}

export function OpsView({ data }: { data: OpsData }) {
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold">Inventory &amp; ops</h1>
      <AnalyticsTabs active="ops" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="ops-stats">
        <Stat label={`Stale (>${data.staleDays}d)`} value={data.staleCount} sub="Listed, still unsold" />
        <Stat label="Low stock" value={data.lowStock.length} sub={`≤${data.lowStockAt} left, multi-qty`} />
        <Stat label="Listed but 0 available" value={data.outOfStock} />
        <Stat label="Drafts to review" value={data.imports.depop + data.imports.vinted + data.blogDrafts} />
      </div>
      <form className="flex flex-wrap items-end gap-2 text-sm" method="get">
        <label className="flex flex-col">Stale after (days)<input name="stale" type="number" min={7} max={365} defaultValue={data.staleDays} className="min-h-[44px] w-28 rounded-lg border border-slate-300 px-2" /></label>
        <button className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4">Apply</button>
        <span className="text-slate-600">Setting: published (listed) Closet/seller items still unsold {data.staleDays}+ days after they were added. Amazon picks are not counted.</span>
      </form>
      <section className="rounded-2xl border border-slate-200 bg-white" data-testid="draft-queues">
        <h2 className="p-3 pb-0 font-semibold">Draft queues</h2>
        <ul className="text-sm">
          <Queue label="Depop imports awaiting approval" n={data.imports.depop} href="/admin/closet?status=draft" />
          <Queue label="Vinted imports awaiting approval" n={data.imports.vinted} href="/admin/closet?status=draft" />
          <Queue label="Blog drafts" n={data.blogDrafts} href="/admin/blog?tab=draft" />
          <Queue label="Daily Drop orders: Printful drafts awaiting acceptance" n={data.drop.printfulDraft} note="Accept in the Printful dashboard (orders stay drafts until you confirm)." />
          <Queue label="Daily Drop orders: Printful draft failed" n={data.drop.printfulFailed} href="/admin/health" />
          <Queue label="Held Drop designs (not for sale, 404)" n={data.heldDesigns} note="Set in the Drop config; they stay hidden until released." />
        </ul>
      </section>
      <Listings title={`Stale listings (oldest first, ${data.staleCount} total)`} rows={data.stale} testId="stale-listings" empty={`Nothing listed longer than ${data.staleDays} days.`} />
      <Listings title="Low stock" rows={data.lowStock} testId="low-stock" empty="No multi-quantity items are low. Unique finds (quantity 1) are not flagged." />
      <p className="text-sm"><Link href="/admin/inventory" className="text-blue-700 underline">Inventory</Link> · <Link href="/admin/closet" className="text-blue-700 underline">Closet Picks</Link> · <Link href="/admin/closet/import" className="text-blue-700 underline">Imports</Link></p>
    </section>
  );
}
