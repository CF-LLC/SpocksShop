import { getSession } from "@/lib/auth/session";
import { aiConfig } from "@/lib/ai/config";
import { aiBillingSettings } from "@/lib/ai/billing";
import { usageSummary } from "@/lib/ai/usage";

const usd = (micros: number) => `$${(micros / 1e6).toFixed(micros < 10_000 ? 4 : 2)}`;

export default async function AdminAiPage() {
  const session = await getSession();
  const cfg = aiConfig();
  const billing = aiBillingSettings();
  const s = await usageSummary(session?.userId);
  const rows = [["Last 24 h", s.today], ["Last 30 days", s.month], ["All time", s.all]] as const;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">AI suggestions</h1>
      <dl className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <dt className="text-slate-500">Provider</dt><dd>{cfg.provider}</dd>
        <dt className="text-slate-500">Model</dt><dd className="font-mono text-xs">{cfg.model}</dd>
        <dt className="text-slate-500">Key</dt><dd>{cfg.apiKey ? "Set" : "Not set (AI off)"}</dd>
        <dt className="text-slate-500">List price</dt><dd>${cfg.price.input}/M in · ${cfg.price.output}/M out</dd>
        <dt className="text-slate-500">Limits</dt><dd>{cfg.perMinute}/min · {cfg.dailyLimit}/day per user</dd>
        <dt className="text-slate-500">Seller billing</dt><dd>{billing.enabled ? "On" : "Off (sellers can't use AI)"}</dd>
      </dl>
      <h2 className="font-semibold">Your usage (free for admin/staff)</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Period</th><th className="p-2">Requests</th><th className="p-2">Tokens in / out</th><th className="p-2">Est. cost</th></tr></thead>
          <tbody>
            {rows.map(([name, r]) => (
              <tr key={name} className="border-t border-slate-100"><td className="p-2">{name}</td><td className="p-2">{r.n} ({r.ok} ok)</td><td className="p-2">{r.input.toLocaleString()} / {r.output.toLocaleString()}</td><td className="p-2">{usd(r.micros)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="font-semibold">Recent requests</h2>
      {s.recent.length ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {s.recent.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 p-2">
              <span>{e.createdAt.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "short", timeStyle: "short" })} CT</span>
              <span className="font-mono text-xs">{e.model}</span>
              <span>{e.imageCount} photo{e.imageCount === 1 ? "" : "s"} · {e.status}</span>
              <span>{usd(e.estCostMicros)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-600">No AI requests yet.</p>}
    </section>
  );
}
