import { sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";

/** Admin Sales report from the shop's own order tables + first-party Amazon click-outs. */
type Row = Record<string, unknown>;
const q = async <T,>(db: typeof Db, s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];

/** Closet orders that took money (excludes not-yet-paid, held-for-approval, declined and canceled). */
export const PAID_EXCLUDED = ["pending", "canceled", "declined", "held"] as const;
const notPaid = sql.raw(`(${PAID_EXCLUDED.map((s) => `'${s}'`).join(", ")})`);

export type Surface = "closet" | "drop" | "picks" | "blog" | "other";
export const SURFACE_LABEL: Record<Surface, string> = { closet: "Closet item pages", drop: "Daily Drop", picks: "Amazon Picks", blog: "Blog & guides", other: "Other pages" };

/** Which part of the site an Amazon click-out came from, by the page path it was clicked on. */
export function surfaceOf(path: string | null | undefined): Surface {
  const p = path ?? "";
  if (p.startsWith("/drop")) return "drop";
  if (/^\/shop\/[^/]+/.test(p)) return "closet";
  if (p === "/" || p.startsWith("/shop") || p.startsWith("/picks") || p.startsWith("/gifts")) return "picks";
  if (p.startsWith("/blog") || p.startsWith("/guides")) return "blog";
  return "other";
}

export type SalesData = {
  days: number;
  closet: { orders: number; revenueCents: number; taxCents: number; shippingCents: number; refundsCents: number };
  drop: { orders: number; revenueCents: number };
  byDay: { day: string; orders: number; revenueCents: number }[];
  bestSellers: { title: string; qty: number; revenueCents: number }[];
  clicksBySurface: { surface: Surface; n: number }[];
  clicksByPick: { asin: string; title: string | null; n: number; closet: number; drop: number; picks: number; other: number }[];
};

export async function loadSales(db: typeof Db, days = 30): Promise<SalesData> {
  const win = sql`created_at >= now() - make_interval(days => ${days})`;
  const [c] = await q<Row>(db, sql`select count(*)::int as orders, coalesce(sum(total_cents),0)::int as rev, coalesce(sum(tax_cents),0)::int as tax, coalesce(sum(shipping_cents),0)::int as ship
    from orders where status not in ${notPaid} and ${win}`);
  const [r] = await q<Row>(db, sql`select coalesce(sum(r.amount_cents),0)::int as n from refunds r where r.created_at >= now() - make_interval(days => ${days})`).catch(() => [{ n: 0 }]);
  const [d] = await q<Row>(db, sql`select count(*)::int as orders, coalesce(sum(amount_total),0)::int as rev from drop_orders where not admin_test and ${win}`);
  const byDay = await q<{ day: string; orders: number; revenueCents: number }>(db, sql`
    select day, sum(orders)::int as orders, sum(rev)::int as "revenueCents" from (
      select (created_at at time zone 'America/Chicago')::date::text as day, count(*) as orders, sum(total_cents) as rev from orders where status not in ${notPaid} and ${win} group by 1
      union all
      select (created_at at time zone 'America/Chicago')::date::text, count(*), sum(coalesce(amount_total,0)) from drop_orders where not admin_test and ${win} group by 1
    ) x group by day order by day`);
  const bestSellers = await q<{ title: string; qty: number; revenueCents: number }>(db, sql`
    select title, sum(qty)::int as qty, sum(rev)::int as "revenueCents" from (
      select oi.title_snapshot as title, oi.quantity as qty, oi.unit_price_cents * oi.quantity as rev
        from order_items oi join orders o on o.id = oi.order_id where o.status not in ${notPaid} and o.created_at >= now() - make_interval(days => ${days})
      union all
      select 'Daily Drop: ' || coalesce(li->>'slug', 'design') || ' ' || coalesce(li->>'garment', ''), coalesce((li->>'qty')::int, 1), 0
        from drop_orders d, jsonb_array_elements(case when jsonb_typeof(d.items) = 'array' then d.items else '[]'::jsonb end) li where not d.admin_test and d.created_at >= now() - make_interval(days => ${days})
    ) x group by title order by 2 desc, 3 desc limit 10`);
  const clicks = await q<{ path: string | null; ref: string | null; n: number }>(db, sql`
    select path, ref, count(*)::int as n from analytics_events where name = 'amazon_click' and not test and ${win} group by 1, 2`);
  const asins = [...new Set(clicks.map((c) => c.ref).filter((a): a is string => !!a && a !== "link"))];
  const titles = asins.length
    ? await q<{ asin: string; title: string }>(db, sql`select distinct on (k) k as asin, title from (
        select coalesce(upper(asin), upper(substring(amazon_url from '/(?:dp|gp/product)/([A-Za-z0-9]{10})'))) as k, title from affiliate_items) t
        where k in (${sql.join(asins.map((a) => sql`${a.toUpperCase()}`), sql`, `)})`)
    : [];
  return { days, ...summarizeClicks(clicks, new Map(titles.map((t) => [t.asin, t.title]))),
    closet: { orders: Number(c?.orders ?? 0), revenueCents: Number(c?.rev ?? 0), taxCents: Number(c?.tax ?? 0), shippingCents: Number(c?.ship ?? 0), refundsCents: Number(r?.n ?? 0) },
    drop: { orders: Number(d?.orders ?? 0), revenueCents: Number(d?.rev ?? 0) }, byDay, bestSellers };
}

export function summarizeClicks(clicks: { path: string | null; ref: string | null; n: number }[], titles: Map<string, string>) {
  const surf = new Map<Surface, number>();
  const pick = new Map<string, SalesData["clicksByPick"][number]>();
  for (const c of clicks) {
    const s = surfaceOf(c.path);
    surf.set(s, (surf.get(s) ?? 0) + c.n);
    const asin = (c.ref ?? "link").toUpperCase();
    const p = pick.get(asin) ?? { asin, title: titles.get(asin) ?? null, n: 0, closet: 0, drop: 0, picks: 0, other: 0 };
    p.n += c.n;
    if (s === "closet" || s === "drop" || s === "picks") p[s] += c.n; else p.other += c.n;
    pick.set(asin, p);
  }
  return {
    clicksBySurface: (["picks", "closet", "drop", "blog", "other"] as Surface[]).map((surface) => ({ surface, n: surf.get(surface) ?? 0 })),
    clicksByPick: [...pick.values()].sort((a, b) => b.n - a.n).slice(0, 50),
  };
}
