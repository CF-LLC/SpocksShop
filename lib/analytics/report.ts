import { sql, type SQL } from "drizzle-orm";
import type { db as Db } from "@/lib/db";

/** Admin reporting over raw events (last 90 days) + daily rollups (older). Test rows are excluded. */
type Row = Record<string, unknown>;
const rows = async <T,>(db: typeof Db, q: SQL) => ((await db.execute(q)) as unknown as Row[]).map((r) => r as T);
const RAW = sql`not test`;
const since = (days: number) => sql`created_at >= now() - make_interval(days => ${days})`;
const TZ = sql.raw(`'America/Chicago'`);

export type Count = { key: string; n: number };
export type DayPoint = { day: string; views: number; visitors: number };

/** Page views + visitors (sum of daily unique visitors) in a window, optionally limited to a path prefix. */
export async function totals(db: typeof Db, days: number | null, prefix?: string) {
  const p = prefix ? sql`and path like ${prefix + "%"}` : sql``;
  const raw = await rows<{ views: number; visitors: number }>(db, sql`
    select count(*)::int as views, count(distinct ((created_at at time zone ${TZ})::date::text || visitor))::int as visitors
    from analytics_events where name = 'page_view' and ${RAW} ${days ? sql`and ${since(days)}` : sql``} ${p}`);
  let { views, visitors } = raw[0] ?? { views: 0, visitors: 0 };
  if (days === null) {
    const old = await rows<{ views: number; visitors: number }>(db, sql`select coalesce(sum(n),0)::int as views, coalesce(sum(visitors),0)::int as visitors from analytics_daily where name = 'page_view' ${prefix ? sql`and path like ${prefix + "%"}` : sql``}`);
    views += old[0]?.views ?? 0; visitors += old[0]?.visitors ?? 0;
  }
  return { views, visitors };
}

export async function trend(db: typeof Db, days: number, prefix?: string): Promise<DayPoint[]> {
  const got = await rows<DayPoint>(db, sql`
    select (created_at at time zone ${TZ})::date::text as day, count(*)::int as views, count(distinct visitor)::int as visitors
    from analytics_events where name = 'page_view' and ${RAW} and ${since(days)} ${prefix ? sql`and path like ${prefix + "%"}` : sql``}
    group by 1 order by 1`);
  const by = new Map(got.map((g) => [g.day, g]));
  const out: DayPoint[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" });
  for (let i = days - 1; i >= 0; i--) {
    const day = fmt.format(new Date(Date.now() - i * 86_400_000));
    out.push(by.get(day) ?? { day, views: 0, visitors: 0 });
  }
  return out;
}

export async function topBy(db: typeof Db, col: "path" | "source" | "term" | "ref", opts: { name?: string; days: number; prefix?: string; limit?: number }): Promise<Count[]> {
  const c = sql.raw(col);
  return rows<Count>(db, sql`
    select ${c} as key, count(*)::int as n from analytics_events
    where name = ${opts.name ?? "page_view"} and ${RAW} and ${since(opts.days)} and ${c} is not null ${opts.prefix ? sql`and path like ${opts.prefix + "%"}` : sql``}
    group by 1 order by 2 desc, 1 limit ${opts.limit ?? 10}`);
}

/** Views per path for 7d / 30d / all time (raw + rollups). */
export async function viewsPerPath(db: typeof Db, prefix: string) {
  return rows<{ path: string; d7: number; d30: number; all: number }>(db, sql`
    with r as (
      select path, count(*) filter (where ${since(7)})::int as d7, count(*) filter (where ${since(30)})::int as d30, count(*)::int as n
      from analytics_events where name = 'page_view' and ${RAW} and path like ${prefix + "%"} group by path
    ), o as (select path, sum(n)::int as n from analytics_daily where name = 'page_view' and path like ${prefix + "%"} group by path)
    select coalesce(r.path, o.path) as path, coalesce(r.d7,0) as d7, coalesce(r.d30,0) as d30, (coalesce(r.n,0) + coalesce(o.n,0))::int as "all"
    from r full join o on o.path = r.path order by 4 desc, 3 desc limit 100`);
}

export async function eventCounts(db: typeof Db, days: number): Promise<Record<string, number>> {
  const r = await rows<{ name: string; n: number }>(db, sql`select name, count(*)::int as n from analytics_events where ${RAW} and ${since(days)} group by 1`);
  return Object.fromEntries(r.map((x) => [x.name, x.n]));
}

/** Orders side of the funnel, from the shop's own tables (Stripe sessions created / paid). */
export async function orderFunnel(db: typeof Db, days: number) {
  const [o] = await rows<{ created: number; paid: number }>(db, sql`
    select count(*)::int as created, count(*) filter (where status not in ('pending', 'canceled'))::int as paid
    from orders where created_at >= now() - make_interval(days => ${days})`);
  const [d] = await rows<{ paid: number }>(db, sql`select count(*)::int as paid from drop_orders where not admin_test and created_at >= now() - make_interval(days => ${days})`);
  return { closetSessions: o?.created ?? 0, closetPaid: o?.paid ?? 0, dropPaid: d?.paid ?? 0 };
}

export async function firstEvent(db: typeof Db): Promise<string | null> {
  const [r] = await rows<{ first: string | null }>(db, sql`select least((select min(created_at) from analytics_events where name = 'page_view'), (select min(day)::timestamptz from analytics_daily))::text as first`);
  return r?.first ?? null;
}
