import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { DropDeps } from "./core";
import { createPrintfulOrder } from "./printful";

export const dropDeps: DropDeps = {
  async claim(sessionId, email, items, amount, adminTest = false) {
    const rows = await db.execute(sql`insert into drop_orders (stripe_session_id, email, items, amount_total, admin_test)
      values (${sessionId}, ${email}, ${JSON.stringify(items)}::jsonb, ${amount}, ${adminTest})
      on conflict (stripe_session_id) do nothing returning id`);
    return (rows as unknown as unknown[]).length > 0;
  },
  async redeemPromo(code, sessionId) {
    await db.execute(sql`update drop_signups set redeemed_session_id=${sessionId}, redeemed_at=now() where code=${code} and redeemed_at is null`);
  },
  async setResult(sessionId, status, printfulOrderId, error) {
    await db.execute(sql`update drop_orders set status=${status}, printful_order_id=${printfulOrderId}, error=${error}, updated_at=now()
      where stripe_session_id=${sessionId}`);
  },
  createPrintfulOrder: (body, confirm) => createPrintfulOrder(body, confirm),
};
