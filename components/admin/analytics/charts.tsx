import Link from "next/link";
import type { Count, DayPoint } from "@/lib/analytics/report";

/** Dependency-free SVG bar chart of daily page views (visitors as a line). */
export function TrendChart({ points, label }: { points: DayPoint[]; label: string }) {
  const max = Math.max(1, ...points.map((p) => p.views));
  const W = 600, H = 140, bw = W / Math.max(points.length, 1);
  const total = points.reduce((s, p) => s + p.views, 0);
  const line = points.map((p, i) => `${i * bw + bw / 2},${H - (p.visitors / max) * (H - 10)}`).join(" ");
  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="trend-chart">
      <figcaption className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold">{label}</span><span className="text-slate-600">{total} views · bars = views, line = visitors</span></figcaption>
      {total === 0 ? <p className="text-sm text-slate-600">No views counted in this period yet.</p> : (
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-auto w-full" role="img" aria-label={`${label}: ${total} views`}>
          {points.map((p, i) => {
            const h = (p.views / max) * (H - 10);
            return <rect key={p.day} x={i * bw + 1} y={H - h} width={Math.max(bw - 2, 1)} height={h} rx="2" className="fill-sky-500"><title>{`${p.day}: ${p.views} views, ${p.visitors} visitors`}</title></rect>;
          })}
          <polyline points={line} fill="none" strokeWidth="2" className="stroke-slate-800" />
          <text x="0" y={H + 14} fontSize="11" className="fill-slate-500">{points[0]?.day}</text>
          <text x={W} y={H + 14} fontSize="11" textAnchor="end" className="fill-slate-500">{points[points.length - 1]?.day}</text>
        </svg>
      )}
    </figure>
  );
}

export function TopList({ title, rows, empty = "Nothing yet.", testId }: { title: string; rows: Count[]; empty?: string; testId?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={testId}>
      <h2 className="font-semibold">{title}</h2>
      {rows.length ? (
        <ol className="mt-2 space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="relative overflow-hidden rounded">
              <span className="absolute inset-y-0 left-0 bg-sky-100" style={{ width: `${(r.n / max) * 100}%` }} aria-hidden />
              <span className="relative flex justify-between gap-3 px-1.5 py-0.5"><span className="break-all">{r.key}</span><span className="font-semibold">{r.n}</span></span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-2 text-sm text-slate-600">{empty}</p>}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function AnalyticsTabs({ active }: { active: "overview" | "blog" | "sales" | "ops" | "signups" }) {
  const tab = (href: string, label: string, on: boolean) => <Link href={href} className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold ${on ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`} aria-current={on ? "page" : undefined}>{label}</Link>;
  return <nav className="flex flex-wrap gap-2" aria-label="Analytics sections">{tab("/admin/analytics", "Overview", active === "overview")}{tab("/admin/analytics/blog", "Blog", active === "blog")}{tab("/admin/analytics/sales", "Sales", active === "sales")}{tab("/admin/analytics/ops", "Ops", active === "ops")}</nav>;
}
