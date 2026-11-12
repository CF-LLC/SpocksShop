import { sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";
import { asinFromUrl } from "@/lib/commerce/affiliate";
import { chicagoDate } from "@/lib/shop/daily-pick-core";

/**
 * Outbound Amazon clicks already live in analytics_events (name = amazon_click).
 * This module only reads those rows. It does not record a second counter.
 * Raw rows are kept about 90 days; older days are rolled up without a per-pick ref.
 */

export type ClickTotals = { n: number; d7: number; d30: number };

export type ClickAggregate = { ref: string; n: number; d7: number; d30: number };

const zero = (): ClickTotals => ({ n: 0, d7: 0, d30: 0 });

function add(a: ClickTotals, b: ClickTotals): ClickTotals {
  return { n: a.n + b.n, d7: a.d7 + b.d7, d30: a.d30 + b.d30 };
}

/** ASIN the public link actually sends, which is what the click beacon records. */
export function clickKeyFor(item: { asin?: string | null; amazonUrl?: string | null }): string | null {
  if (item.amazonUrl) {
    const fromUrl = asinFromUrl(item.amazonUrl);
    if (fromUrl) return fromUrl;
  }
  const asin = item.asin?.trim().toUpperCase();
  return asin && /^[A-Z0-9]{10}$/.test(asin) ? asin : null;
}

export function attributeAffiliateClicks(
  items: readonly { id: string; asin: string | null; amazonUrl: string | null }[],
  rows: readonly ClickAggregate[],
): { byId: Record<string, ClickTotals>; totals: ClickTotals; unattributed: ClickTotals } {
  const byRef = new Map<string, ClickTotals>();
  let totals = zero();
  let unattributed = zero();
  for (const row of rows) {
    const n = { n: Number(row.n) || 0, d7: Number(row.d7) || 0, d30: Number(row.d30) || 0 };
    totals = add(totals, n);
    const ref = row.ref.trim().toUpperCase();
    if (!ref || ref === "LINK") {
      unattributed = add(unattributed, n);
      continue;
    }
    byRef.set(ref, add(byRef.get(ref) ?? zero(), n));
  }
  const byId: Record<string, ClickTotals> = {};
  for (const item of items) {
    const key = clickKeyFor(item);
    byId[item.id] = key ? (byRef.get(key) ?? zero()) : { ...zero() };
  }
  return { byId, totals, unattributed };
}

/** Last `n` America/Chicago calendar days, oldest first. */
export function recentChicagoDays(now = new Date(), n = 7): string[] {
  return Array.from({ length: n }, (_, i) => chicagoDate(now, i - (n - 1)));
}

export function fillClickDays(days: readonly string[], rows: readonly { day: string; n: number }[]): { day: string; n: number }[] {
  const map = new Map(rows.map((row) => [row.day, Number(row.n) || 0]));
  return days.map((day) => ({ day, n: map.get(day) ?? 0 }));
}

type RawClick = { ref: string | null; n: number; d7: number; d30: number };
type RawDay = { day: string; n: number };

/** Read existing amazon_click aggregates. Failure returns zeros so the catalog still loads. */
export async function loadAffiliateClicks(db: typeof Db, now = new Date()) {
  const days = recentChicagoDays(now, 7);
  try {
    const [rows, daily] = await Promise.all([
      db.execute(sql`
        select coalesce(upper(ref), '') as ref,
          count(*)::int as n,
          count(*) filter (where created_at >= now() - interval '7 days')::int as d7,
          count(*) filter (where created_at >= now() - interval '30 days')::int as d30
        from analytics_events
        where name = 'amazon_click' and not test
        group by 1
      `) as Promise<unknown> as Promise<RawClick[]>,
      db.execute(sql`
        select (created_at at time zone 'America/Chicago')::date::text as day, count(*)::int as n
        from analytics_events
        where name = 'amazon_click' and not test
          and created_at >= now() - interval '8 days'
        group by 1
      `) as Promise<unknown> as Promise<RawDay[]>,
    ]);
    return {
      rows: rows.map((row) => ({ ref: row.ref ?? "", n: Number(row.n) || 0, d7: Number(row.d7) || 0, d30: Number(row.d30) || 0 })),
      daily: fillClickDays(days, daily),
    };
  } catch (err) {
    console.error("affiliate click counts failed", err);
    return { rows: [] as ClickAggregate[], daily: fillClickDays(days, []) };
  }
}
