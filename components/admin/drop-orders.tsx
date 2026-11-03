import Link from "next/link";
import { formatCents } from "@/lib/commerce/money";
import { dropItemsLabel, dropStatusLabel, type DropFilter, type DropOrderRow } from "@/lib/admin/drop-orders";

const when = (d: Date | string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(d)) + " CT";

export function DropOrdersSection({ rows, filter }: { rows: DropOrderRow[]; filter: DropFilter }) {
  const tabs: [DropFilter, string][] = [["all", "All"], ["real", "Real"], ["test", "Admin tests"]];
  return (
    <section aria-labelledby="drop-title" className="space-y-3" data-testid="drop-orders">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="drop-title" className="text-lg font-semibold">Daily Drop orders <span className="rounded-full bg-slate-100 px-2 py-0.5 text-sm">{rows.length}</span></h2>
        <nav className="flex gap-1 text-sm" aria-label="Daily Drop filter">
          {tabs.map(([k, label]) => (
            <Link key={k} href={k === "all" ? "/admin/orders" : `/admin/orders?drop=${k}`} aria-current={filter === k ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${filter === k ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>{label}</Link>
          ))}
        </nav>
      </div>
      <p className="text-xs text-slate-600">Print-on-demand orders paid through Stripe. Printful drafts are not produced or charged until accepted in the Printful dashboard.</p>
      {rows.length === 0 ? <p className="text-sm text-slate-600">No Daily Drop orders{filter === "all" ? "" : " for this filter"}.</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 p-3 text-sm" data-testid="drop-order">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-900">Daily Drop</span>
                  {r.status === "refunded" ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-900" data-testid="refunded-badge">Refunded</span> : null}
                  {r.admin_test ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900" data-testid="test-badge">Test</span> : null}
                  <span className="font-mono">DD-{r.id}</span>
                </span>
                <span className="font-semibold">{r.amount_total == null ? "—" : formatCents(r.amount_total)}</span>
              </div>
              <div>{dropItemsLabel(r.items)}</div>
              <div className="text-xs text-slate-600">
                {dropStatusLabel[r.status] ?? r.status}{r.printful_order_id ? ` · Printful #${r.printful_order_id}` : ""} · {when(r.created_at)} · {r.email ?? "—"} · Stripe …{r.stripe_session_id.slice(-8)}
              </div>
              {r.error ? <div className="text-xs text-red-700">{r.error}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
