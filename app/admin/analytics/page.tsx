import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { EVENT_LABELS, EVENT_NAMES } from "@/lib/analytics/events";

export const dynamic = "force-dynamic";

const WINDOWS = [
  ["Today", 1],
  ["7 days", 7],
  ["30 days", 30],
] as const;

function Top({ title, rows }: { title: string; rows: { key: string | null; n: number }[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length ? (
        <ol className="mt-2 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.key ?? "none"} className="flex justify-between gap-3"><span className="break-all">{r.key ?? "(unknown)"}</span><span className="font-semibold">{r.n}</span></li>
          ))}
        </ol>
      ) : <p className="mt-2 text-sm text-slate-600">Nothing yet.</p>}
    </section>
  );
}

export default async function AnalyticsPage() {
  const since = (days: number) => sql`now() - make_interval(days => ${days})`;
  const totals = await Promise.all(
    WINDOWS.map(([, d]) =>
      db.select({ name: analyticsEvents.name, n: count() }).from(analyticsEvents).where(sql`${analyticsEvents.createdAt} >= ${since(d)}`).groupBy(analyticsEvents.name),
    ),
  );
  const top = (name: string, col: typeof analyticsEvents.path | typeof analyticsEvents.ref) =>
    db
      .select({ key: col, n: count() })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.name, name), sql`${analyticsEvents.createdAt} >= ${since(30)}`))
      .groupBy(col)
      .orderBy(desc(count()))
      .limit(10);
  const [topViews, topAmazon, topCheckoutPages] = await Promise.all([top("product_view", analyticsEvents.path), top("amazon_click", analyticsEvents.ref), top("checkout_start", analyticsEvents.path)]);
  const [{ first }] = await db.select({ first: sql<string | null>`min(${analyticsEvents.createdAt})::text` }).from(analyticsEvents);
  const n = (rows: { name: string; n: number }[], name: string) => rows.find((r) => r.name === name)?.n ?? 0;


  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">
          Shop events counted on our own server: no cookies, no IP addresses, no personal data. Your own visits while signed in aren&apos;t counted. Page views and visitors are in Cloudflare Web Analytics (dash.cloudflare.com → Analytics &amp; Logs → Web Analytics → spockshop.com).
          {first ? ` Counting since ${new Date(first).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}.` : ""}
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm" data-testid="analytics-totals">
          <thead><tr className="text-left text-slate-600"><th className="p-3">Event</th>{WINDOWS.map(([l]) => <th key={l} className="p-3 text-right">{l}</th>)}</tr></thead>
          <tbody>
            {EVENT_NAMES.map((name) => (
              <tr key={name} className="border-t border-slate-100"><td className="p-3 font-medium">{EVENT_LABELS[name]}</td>{totals.map((rows, i) => <td key={i} className="p-3 text-right font-semibold">{n(rows, name)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Top title="Most viewed items (30 days)" rows={topViews} />
        <Top title="Amazon picks clicked (ASIN)" rows={topAmazon} />
        <Top title="Checkout starts by page" rows={topCheckoutPages} />
      </div>
    </section>
  );
}
