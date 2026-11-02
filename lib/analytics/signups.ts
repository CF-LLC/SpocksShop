import { sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";

/** Aggregate-only view of Daily Drop signups and their one-time 10% codes. Never selects emails or codes. */
export type SignupsData = {
  days: number;
  total: number; used: number; unused: number; unsubscribed: number; lastDays: number;
  byDay: { day: string; signups: number; redeemed: number }[];
  bySource: { key: string; n: number }[];
};

export const rate = (used: number, total: number) => (total ? `${Math.round((used / total) * 1000) / 10}%` : "—");

export async function loadSignups(db: typeof Db, days = 30): Promise<SignupsData> {
  const q = async <T,>(s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];
  const [c] = await q<{ total: number; used: number; unsub: number; recent: number }>(sql`select count(*)::int as total, count(*) filter (where redeemed_at is not null)::int as used,
    count(*) filter (where unsubscribed)::int as unsub, count(*) filter (where created_at >= now() - make_interval(days => ${days}))::int as recent from drop_signups`);
  const byDay = await q<{ day: string; signups: number; redeemed: number }>(sql`
    select day::text, sum(s)::int as signups, sum(r)::int as redeemed from (
      select (created_at at time zone 'America/Chicago')::date as day, 1 as s, 0 as r from drop_signups where created_at >= now() - make_interval(days => ${days})
      union all
      select (redeemed_at at time zone 'America/Chicago')::date, 0, 1 from drop_signups where redeemed_at >= now() - make_interval(days => ${days})
    ) x group by day order by day desc`);
  const bySource = await q<{ key: string; n: number }>(sql`select coalesce(nullif(source, ''), 'unknown') as key, count(*)::int as n from drop_signups group by 1 order by 2 desc limit 10`);
  const total = c?.total ?? 0, used = c?.used ?? 0;
  return { days, total, used, unused: total - used, unsubscribed: c?.unsub ?? 0, lastDays: c?.recent ?? 0, byDay, bySource };
}
