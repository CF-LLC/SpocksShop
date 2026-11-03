import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { DESIGNS, GARMENT_LABEL } from "@/lib/drop/config";

export type DropOrderRow = {
  id: number; stripe_session_id: string; status: string; printful_order_id: string | null; email: string | null;
  items: unknown; amount_total: number | null; error: string | null; admin_test: boolean; created_at: Date | string;
};
export type DropFilter = "all" | "real" | "test";
export const parseDropFilter = (v: unknown): DropFilter => (v === "real" || v === "test" ? v : "all");

/** Daily Drop orders live in drop_orders (Stripe webhook -> Printful draft), not in the shop orders table. */
export const DROP_ORDERS_SQL = (f: DropFilter) =>
  sql`select id, stripe_session_id, status, printful_order_id, email, items, amount_total, error, admin_test, created_at
      from drop_orders where (${f}::text = 'all' or (${f}::text = 'test') = admin_test) order by created_at desc limit 200`;

export async function listDropOrders(f: DropFilter): Promise<DropOrderRow[]> {
  return (await db.execute(DROP_ORDERS_SQL(f))) as unknown as DropOrderRow[];
}

export function dropItemsLabel(items: unknown): string {
  if (!Array.isArray(items)) return "—";
  return items.map((l: { slug?: string; garment?: string; size?: string; qty?: number }) => {
    const title = DESIGNS.find((d) => d.slug === l.slug)?.title ?? l.slug ?? "?";
    const g = (GARMENT_LABEL as Record<string, string>)[l.garment ?? ""] ?? l.garment ?? "";
    return `${title} ${g}${l.size ? ` ${l.size}` : ""}${(l.qty ?? 1) > 1 ? ` ×${l.qty}` : ""}`.trim();
  }).join(", ") || "—";
}

export const dropStatusLabel: Record<string, string> = {
  received: "Received", printful_draft: "Printful draft (not confirmed)", printful_confirmed: "Sent to Printful", printful_failed: "Printful failed",
};
