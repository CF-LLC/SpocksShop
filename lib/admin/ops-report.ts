import { sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";

/** Defaults shown on the Ops tab. Stale = published (listed) and still unsold this many days after listing. */
export const STALE_DAYS = 60;
export const LOW_STOCK_AT = 2;

const q = async <T,>(db: typeof Db, s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];
export type Listing = { id: string; title: string; sku: string; source: string; available: number; ageDays: number };
export type OpsData = {
  staleDays: number; lowStockAt: number;
  stale: Listing[]; staleCount: number; lowStock: Listing[]; outOfStock: number;
  imports: { depop: number; vinted: number }; blogDrafts: number;
  drop: { printfulDraft: number; printfulFailed: number; received: number }; heldDesigns: number;
};

export function clampDays(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 7 && n <= 365 ? Math.round(n) : STALE_DAYS;
}

export async function loadOps(db: typeof Db, heldDesigns: number, staleDays = STALE_DAYS): Promise<OpsData> {
  const base = sql`from products p left join inventory i on i.product_id = p.id where p.status = 'listed'`;
  const avail = sql`greatest(coalesce(i.quantity_on_hand, 1) - coalesce(i.quantity_reserved, 0), 0)`;
  const cols = sql`p.id::text as id, p.title, p.sku, p.source, ${avail}::int as available, floor(extract(epoch from now() - p.created_at) / 86400)::int as "ageDays"`;
  const [stale, [sc], low, [oos], imp, [bd], drops] = await Promise.all([
    q<Listing>(db, sql`select ${cols} ${base} and p.source <> 'affiliate' and p.created_at < now() - make_interval(days => ${staleDays}) order by p.created_at limit 25`),
    q<{ n: number }>(db, sql`select count(*)::int as n ${base} and p.source <> 'affiliate' and p.created_at < now() - make_interval(days => ${staleDays})`),
    q<Listing>(db, sql`select ${cols} ${base} and not p.unique_find and ${avail} <= ${LOW_STOCK_AT} order by 5, p.title limit 25`),
    q<{ n: number }>(db, sql`select count(*)::int as n ${base} and ${avail} = 0`),
    q<{ source: string; n: number }>(db, sql`select pi.source, count(distinct p.id)::int as n from product_imports pi join products p on p.id = pi.product_id where p.status in ('draft', 'pending_approval') group by 1`),
    q<{ n: number }>(db, sql`select count(*)::int as n from blog_posts where status = 'draft'`),
    q<{ status: string; n: number }>(db, sql`select status, count(*)::int as n from drop_orders where not admin_test group by 1`),
  ]);
  const imports = { depop: 0, vinted: 0 };
  for (const r of imp) if (r.source === "depop" || r.source === "vinted") imports[r.source] = r.n;
  const ds = Object.fromEntries(drops.map((d) => [d.status, d.n]));
  return { staleDays, lowStockAt: LOW_STOCK_AT, stale, staleCount: sc?.n ?? 0, lowStock: low, outOfStock: oos?.n ?? 0, imports, blogDrafts: bd?.n ?? 0,
    drop: { printfulDraft: ds.printful_draft ?? 0, printfulFailed: ds.printful_failed ?? 0, received: ds.received ?? 0 }, heldDesigns };
}
