import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public liveness probe for the tunnel self-check. Reveals nothing beyond up/down. */
export async function GET() {
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  return Response.json({ ok: true, database }, { status: database ? 200 : 503, headers: { "cache-control": "no-store" } });
}
