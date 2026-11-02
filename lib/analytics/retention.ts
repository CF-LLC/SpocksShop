import { sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";

export const RAW_RETENTION_DAYS = 90;
const EVERY_MS = 6 * 60 * 60 * 1000;
let last = 0;

/**
 * Roll raw rows older than 90 days into analytics_daily (counts + daily unique visitors per
 * day/event/path/source), then delete those raw rows. Test rows are just dropped. Idempotent.
 */
export async function rollupAndPrune(db: typeof Db, days = RAW_RETENTION_DAYS) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into analytics_daily (day, name, path, source, n, visitors)
      select (created_at at time zone 'America/Chicago')::date, name, coalesce(path, ''), coalesce(source, ''), count(*)::int, count(distinct visitor)::int
      from analytics_events
      where created_at < now() - make_interval(days => ${days}) and not test
      group by 1, 2, 3, 4
      on conflict (day, name, path, source) do update set n = analytics_daily.n + excluded.n, visitors = analytics_daily.visitors + excluded.visitors`);
    await tx.execute(sql`delete from analytics_events where created_at < now() - make_interval(days => ${days})`);
  });
}

/** Called from the beacon; runs at most every 6 hours per process and never throws. */
export function maybeRollup(db: typeof Db, now = Date.now()) {
  if (now - last < EVERY_MS) return;
  last = now;
  rollupAndPrune(db).catch(() => {});
}
