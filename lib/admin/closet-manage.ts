import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventory, photos, products } from "@/lib/db/schema";
import { deleteMedia } from "@/lib/media";

/** Closet Picks management: list filters, bulk actions and the soft-delete Trash. */
export const TRASHED = "trashed";
export const CLOSET_STATUSES = ["draft", "listed", "pending_approval", "reserved", "sold", "archived"] as const;
export const SORTS = { updated: "Recently updated", newest: "Newest", oldest: "Oldest", price_desc: "Price: high to low", price_asc: "Price: low to high", title: "Title A–Z" } as const;
export type SortKey = keyof typeof SORTS;

export type ListQuery = {
  q: string;
  status: (typeof CLOSET_STATUSES)[number] | "all";
  source: "all" | "depop" | "manual";
  category: string; // "all" | "none" | category uuid
  sort: SortKey;
  trash: boolean;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseListQuery(p: Record<string, string | string[] | undefined>): ListQuery {
  const status = one(p.status);
  const source = one(p.source);
  const category = one(p.category);
  const sort = one(p.sort);
  return {
    q: one(p.q).trim().slice(0, 100),
    status: (CLOSET_STATUSES as readonly string[]).includes(status) ? (status as ListQuery["status"]) : "all",
    source: source === "depop" || source === "manual" ? source : "all",
    category: category === "none" || UUID.test(category) ? category : "all",
    sort: sort in SORTS ? (sort as SortKey) : "updated",
    trash: one(p.view) === "trash",
  };
}

export type Row = {
  id: string; title: string; sku: string; status: string; priceCents: number; categoryId: string | null;
  updatedAt: Date; createdAt: Date; onHand: number; reserved: number; imported: boolean;
};

/** Filter + sort in memory (a closet is hundreds of items, not millions). */
export function filterRows<T extends Row>(rows: T[], q: ListQuery): T[] {
  const needle = q.q.toLowerCase();
  const out = rows.filter((r) => {
    if (q.trash !== (r.status === TRASHED)) return false;
    if (!q.trash && q.status !== "all" && r.status !== q.status) return false;
    if (q.source === "depop" && !r.imported) return false;
    if (q.source === "manual" && r.imported) return false;
    if (q.category === "none" && r.categoryId) return false;
    if (q.category !== "all" && q.category !== "none" && r.categoryId !== q.category) return false;
    if (needle && !`${r.title} ${r.sku}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const by: Record<SortKey, (a: T, b: T) => number> = {
    updated: (a, b) => +b.updatedAt - +a.updatedAt,
    newest: (a, b) => +b.createdAt - +a.createdAt,
    oldest: (a, b) => +a.createdAt - +b.createdAt,
    price_desc: (a, b) => b.priceCents - a.priceCents,
    price_asc: (a, b) => a.priceCents - b.priceCents,
    title: (a, b) => a.title.localeCompare(b.title),
  };
  return out.sort((a, b) => by[q.sort](a, b) || a.title.localeCompare(b.title));
}

export const BULK_ACTIONS = ["publish", "unpublish", "archive", "mark_sold", "trash", "restore", "purge"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const isBulkAction = (v: unknown): v is BulkAction => (BULK_ACTIONS as readonly string[]).includes(String(v));

type PlanRow = { id: string; status: string; priceCents: number; onHand: number; reserved: number; trashedFromStatus?: string | null };
export type Plan = { ok: { id: string; status: string; from?: string | null }[]; skipped: { id: string; reason: string }[] };

/** Decide, per item, what an action does. Pure so it's easy to test. */
export function planBulk(action: BulkAction, rows: PlanRow[]): Plan {
  const plan: Plan = { ok: [], skipped: [] };
  for (const r of rows) {
    const trashed = r.status === TRASHED;
    const skip = (reason: string) => plan.skipped.push({ id: r.id, reason });
    if (action === "restore" || action === "purge") {
      if (!trashed) { skip("not in Trash"); continue; }
      if (action === "purge" && r.reserved > 0) { skip("in an open checkout"); continue; }
      const back = r.trashedFromStatus && r.trashedFromStatus !== "listed" ? r.trashedFromStatus : "draft";
      plan.ok.push({ id: r.id, status: action === "restore" ? back : "purge" });
      continue;
    }
    if (trashed) { skip("in Trash (restore it first)"); continue; }
    if (r.reserved > 0 && action !== "publish") { skip("in an open checkout"); continue; }
    if (action === "publish") {
      if (r.status === "listed") { skip("already live"); continue; }
      if (r.status === "pending_approval" || r.status === "reserved") { skip("waiting on an order"); continue; }
      if (r.priceCents <= 0) { skip("no price"); continue; }
      if (r.onHand - r.reserved <= 0) { skip("quantity is 0"); continue; }
      plan.ok.push({ id: r.id, status: "listed" });
    } else if (action === "unpublish") {
      if (r.status !== "listed") { skip("not live"); continue; }
      plan.ok.push({ id: r.id, status: "draft" });
    } else if (action === "archive") plan.ok.push({ id: r.id, status: "archived" });
    else if (action === "mark_sold") plan.ok.push({ id: r.id, status: "sold" });
    else if (action === "trash") plan.ok.push({ id: r.id, status: TRASHED, from: r.status });
  }
  return plan;
}

export const ACTION_DONE: Record<BulkAction, string> = {
  publish: "published", unpublish: "unpublished", archive: "archived", mark_sold: "marked sold",
  trash: "moved to Trash", restore: "restored", purge: "permanently deleted",
};

/** Apply an action to Closet items. Only Closet (source=closet) rows are ever touched. */
export async function applyBulk(action: BulkAction, ids: string[]): Promise<Plan> {
  const unique = [...new Set(ids)].slice(0, 500);
  if (!unique.length) return { ok: [], skipped: [] };
  const where = and(inArray(products.id, unique), eq(products.source, "closet"));
  const rows = await db
    .select({ id: products.id, status: products.status, priceCents: products.priceCents, trashedFromStatus: products.trashedFromStatus, onHand: inventory.quantityOnHand, reserved: inventory.quantityReserved })
    .from(products).leftJoin(inventory, eq(inventory.productId, products.id)).where(where);
  const plan = planBulk(action, rows.map((r) => ({ ...r, onHand: r.onHand ?? 0, reserved: r.reserved ?? 0 })));
  if (!plan.ok.length) return plan;
  const now = new Date();
  if (action === "purge") {
    const purge = plan.ok.map((p) => p.id);
    const files = await db.select({ path: photos.storagePath }).from(photos).where(inArray(photos.productId, purge));
    await db.delete(products).where(and(inArray(products.id, purge), eq(products.source, "closet"), eq(products.status, TRASHED)));
    await Promise.all(files.map((f) => deleteMedia(f.path)));
    return plan;
  }
  await db.transaction(async (tx) => {
    for (const p of plan.ok) {
      const extra = action === "trash" ? { trashedAt: now, trashedFromStatus: p.from ?? null } : action === "restore" ? { trashedAt: null, trashedFromStatus: null } : {};
      await tx.update(products).set({ status: p.status, updatedAt: now, ...extra }).where(and(eq(products.id, p.id), eq(products.source, "closet")));
    }
  });
  return plan;
}

export function summarize(action: BulkAction, plan: Plan): string {
  const n = plan.ok.length;
  const head = `${n} item${n === 1 ? "" : "s"} ${ACTION_DONE[action]}.`;
  if (!plan.skipped.length) return head;
  const reasons = [...new Set(plan.skipped.map((s) => s.reason))].join(", ");
  return `${head} ${plan.skipped.length} skipped (${reasons}).`;
}
