import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { email: string; code: string; source: string | null; unsubscribed: boolean; redeemed_at: Date | null; created_at: Date };

export default async function SignupsPage() {
  const rows = (await db.execute(sql`select email, code, source, unsubscribed, redeemed_at, created_at from drop_signups order by created_at desc limit 200`)) as unknown as Row[];
  const [c] = (await db.execute(sql`select count(*)::int as total, count(*) filter (where redeemed_at is not null)::int as redeemed, count(*) filter (where unsubscribed)::int as unsub from drop_signups`)) as unknown as { total: number; redeemed: number; unsub: number }[];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Daily Drop signups</h1>
      <p className="text-sm text-slate-600" data-signup-count>{c?.total ?? 0} signups · {c?.redeemed ?? 0} codes used · {c?.unsub ?? 0} unsubscribed. Capture only: no emails are sent.</p>
      <a className="inline-block rounded-lg border px-3 py-1 text-sm" href="/api/admin/drop-signups">Download CSV</a>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Email</th><th className="p-2">Code</th><th className="p-2">Source</th><th className="p-2">Used</th><th className="p-2">Unsub</th><th className="p-2">Signed up</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-t"><td className="p-2 break-all">{r.email}</td><td className="p-2 font-mono">{r.code}</td><td className="p-2">{r.source ?? ""}</td><td className="p-2">{r.redeemed_at ? "yes" : ""}</td><td className="p-2">{r.unsubscribed ? "yes" : ""}</td><td className="p-2">{new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</td></tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-slate-600">No signups yet.</p>}
      </div>
    </div>
  );
}
