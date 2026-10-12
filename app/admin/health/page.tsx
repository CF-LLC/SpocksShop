import { activityChecks, appCheck, backupCheck, databaseCheck, recentErrors, tunnelCheck, type Check } from "@/lib/health/checks";

const badge: Record<Check["state"], string> = {
  ok: "bg-green-100 text-green-800",
  warn: "bg-amber-100 text-amber-900",
  fail: "bg-red-100 text-red-800",
};
const icon: Record<Check["state"], string> = { ok: "✓", warn: "!", fail: "✕" };

export default async function AdminHealthPage() {
  const [db, backup, tunnel, activity, errors] = await Promise.all([
    databaseCheck(),
    backupCheck(),
    tunnelCheck(),
    activityChecks().catch(() => null),
    recentErrors(20),
  ]);
  const checks: Check[] = [appCheck(), ...db, backup, tunnel, ...(activity?.checks ?? [{ key: "activity", label: "Orders & listings", state: "fail" as const, detail: "Database unavailable" }])];
  const worst = checks.some((c) => c.state === "fail") ? "fail" : checks.some((c) => c.state === "warn") ? "warn" : "ok";

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Site health</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge[worst]}`}>{worst === "ok" ? "All good" : worst === "warn" ? "Needs attention" : "Problem"}</span>
        <span className="ml-auto text-xs text-slate-500">Checked {new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</span>
      </div>
      <ul className="divide-y rounded-xl border">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-3 p-3 text-sm">
            <span aria-label={c.state} className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge[c.state]}`}>{icon[c.state]}</span>
            <span className="w-40 shrink-0 font-medium">{c.label}</span>
            <span className="break-all text-slate-700">{c.detail}</span>
          </li>
        ))}
      </ul>
      <div>
        <h2 className="mb-2 text-lg font-semibold">Recent errors</h2>
        {errors.length === 0 ? <p className="text-sm text-slate-500">No errors logged.</p> : (
          <table className="min-w-full text-left text-xs">
            <thead><tr><th className="p-2">When (CT)</th><th className="p-2">Level</th><th className="p-2">Source</th><th className="p-2">Message</th><th className="p-2">Path</th></tr></thead>
            <tbody>
              {errors.map((e) => {
                const ctx = (e.context ?? {}) as { path?: string };
                return (
                  <tr key={e.id} className="border-t align-top">
                    <td className="whitespace-nowrap p-2">{e.occurredAt.toLocaleString("en-US", { timeZone: "America/Chicago" })}</td>
                    <td className="p-2">{e.level}</td>
                    <td className="p-2 font-mono">{e.source}</td>
                    <td className="p-2">{e.message}</td>
                    <td className="p-2 font-mono">{ctx.path ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
