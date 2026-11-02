import Link from "next/link";
import { rate, type SignupsData } from "@/lib/analytics/signups";
import { AnalyticsTabs, Stat, TopList } from "./charts";

export function SignupsView({ data }: { data: SignupsData }) {
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold">Signups &amp; 10% codes</h1>
      <AnalyticsTabs active="signups" />
      <p className="text-sm text-slate-600">Counts only. Individual signups are on <Link href="/admin/signups" className="text-blue-700 underline">Drop Signups</Link>.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="signup-stats">
        <Stat label="Signups" value={data.total} sub={`${data.lastDays} in last ${data.days} days`} />
        <Stat label="Codes used" value={data.used} sub={`${data.unused} unused`} />
        <Stat label="Redemption rate" value={rate(data.used, data.total)} />
        <Stat label="Unsubscribed" value={data.unsubscribed} />
      </div>
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white" data-testid="signups-by-day">
        <h2 className="p-3 font-semibold">By day (last {data.days} days)</h2>
        {data.byDay.length ? (
          <table className="w-full text-sm"><thead><tr className="text-left text-slate-600"><th className="p-3">Day</th><th className="p-3 text-right">Signups</th><th className="p-3 text-right">Codes used</th></tr></thead>
            <tbody>{data.byDay.map((d) => <tr key={d.day} className="border-t border-slate-100"><td className="p-3">{d.day}</td><td className="p-3 text-right">{d.signups}</td><td className="p-3 text-right">{d.redeemed}</td></tr>)}</tbody></table>
        ) : <p className="px-3 pb-3 text-sm text-slate-600">No signups or code redemptions in this period yet.</p>}
      </section>
      <TopList title="Signups by source" rows={data.bySource} empty="No signups yet." testId="signups-by-source" />
    </section>
  );
}
