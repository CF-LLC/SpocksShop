import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateItems, dailyAmazonPicks } from "@/lib/db/schema";
import { chicagoDate, chooseNextPick, fallbackWhy, resolveWhy } from "@/lib/shop/daily-pick-core";
import { toPublicPick, type PublicPick } from "@/lib/shop/public-pick";

export type DailyPick = { date: string; pick: PublicPick; why: string };
export type DailyPickView = { today: DailyPick | null; tomorrow: DailyPick | null; history: DailyPick[]; poolSize: number };

const LOCK_KEY = 0x5d41_7001; // advisory lock id for daily pick generation

/** Eligible pool: active picks with a link (approved/published). */
async function poolIds(tx: typeof db): Promise<string[]> {
  const rows = await tx.select({ id: affiliateItems.id }).from(affiliateItems).where(eq(affiliateItems.active, true)).orderBy(asc(affiliateItems.id));
  return rows.map((r) => r.id);
}

/**
 * Ensure a pick row exists for `date` (idempotent, concurrency-safe). Once
 * chosen a day is fixed; it is only re-chosen if the item was deactivated or
 * deleted and the day is today or later, so inactive picks never show.
 */
export async function ensureDailyPick(date: string): Promise<void> {
  const existing = await db
    .select({ id: dailyAmazonPicks.affiliateItemId, active: affiliateItems.active })
    .from(dailyAmazonPicks)
    .leftJoin(affiliateItems, eq(affiliateItems.id, dailyAmazonPicks.affiliateItemId))
    .where(eq(dailyAmazonPicks.pickDate, date));
  if (existing[0]?.id && existing[0].active) return;

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
    const again = await tx
      .select({ id: dailyAmazonPicks.affiliateItemId, active: affiliateItems.active })
      .from(dailyAmazonPicks)
      .leftJoin(affiliateItems, eq(affiliateItems.id, dailyAmazonPicks.affiliateItemId))
      .where(eq(dailyAmazonPicks.pickDate, date));
    if (again[0]?.id && again[0].active) return;
    const pool = await poolIds(tx as unknown as typeof db);
    const history = await tx
      .select({ itemId: dailyAmazonPicks.affiliateItemId, cycle: dailyAmazonPicks.cycle })
      .from(dailyAmazonPicks)
      .where(lt(dailyAmazonPicks.pickDate, date))
      .orderBy(asc(dailyAmazonPicks.pickDate));
    const choice = chooseNextPick(date, pool, history);
    if (!choice) return;
    if (again.length) {
      await tx.update(dailyAmazonPicks).set({ affiliateItemId: choice.itemId, cycle: choice.cycle, why: null }).where(eq(dailyAmazonPicks.pickDate, date));
    } else {
      await tx.insert(dailyAmazonPicks).values({ pickDate: date, affiliateItemId: choice.itemId, cycle: choice.cycle }).onConflictDoNothing();
    }
  });
}

async function loadPicks(where: ReturnType<typeof eq> | ReturnType<typeof and>, limit: number): Promise<DailyPick[]> {
  const rows = await db
    .select({ date: dailyAmazonPicks.pickDate, rowWhy: dailyAmazonPicks.why, item: affiliateItems })
    .from(dailyAmazonPicks)
    .innerJoin(affiliateItems, eq(affiliateItems.id, dailyAmazonPicks.affiliateItemId))
    .where(and(where, eq(affiliateItems.active, true)))
    .orderBy(desc(dailyAmazonPicks.pickDate))
    .limit(limit);
  return rows.map((r) => ({
    date: r.date,
    pick: toPublicPick(r.item),
    why: resolveWhy(r.rowWhy, r.item.why) ?? fallbackWhy(r.item.title, r.item.category),
  }));
}

/** Today's pick + recent history; tomorrow only when `includeTomorrow` (signed-in sellers/staff). */
export async function getDailyPickView({ includeTomorrow = false, historyDays = 14, now = new Date() } = {}): Promise<DailyPickView> {
  const today = chicagoDate(now);
  const tomorrow = chicagoDate(now, 1);
  try {
    await ensureDailyPick(today);
    if (includeTomorrow) await ensureDailyPick(tomorrow);
    const [todayRows, tomorrowRows, history, pool] = await Promise.all([
      loadPicks(eq(dailyAmazonPicks.pickDate, today), 1),
      includeTomorrow ? loadPicks(eq(dailyAmazonPicks.pickDate, tomorrow), 1) : Promise.resolve([]),
      loadPicks(lt(dailyAmazonPicks.pickDate, today), historyDays),
      poolIds(db),
    ]);
    return { today: todayRows[0] ?? null, tomorrow: tomorrowRows[0] ?? null, history, poolSize: pool.length };
  } catch (err) {
    console.error("daily pick failed", err);
    return { today: null, tomorrow: null, history: [], poolSize: 0 };
  }
}

/** Signed-in sellers and staff/admin can see tomorrow's pick one day ahead. */
export async function canPreviewTomorrow(): Promise<boolean> {
  try {
    const [{ getSellerSession }, { getSession, isStaffSession }] = await Promise.all([import("@/lib/auth/seller-session"), import("@/lib/auth/session")]);
    if (await getSellerSession()) return true;
    return isStaffSession(await getSession());
  } catch {
    return false;
  }
}
