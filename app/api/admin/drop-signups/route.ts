import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const csv = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Admin-only CSV export (middleware also guards /api/admin). */
export async function GET() {
  if ((await getSession().catch(() => null))?.role !== "admin") return new Response("Not found", { status: 404 });
  const rows = (await db.execute(sql`select email, code, source, unsubscribed, redeemed_at, created_at from drop_signups order by created_at desc`)) as unknown as Record<string, unknown>[];
  const head = ["email", "code", "source", "unsubscribed", "redeemed_at", "created_at"];
  const body = [head.join(","), ...rows.map((r) => head.map((h) => csv(r[h] instanceof Date ? (r[h] as Date).toISOString() : r[h])).join(","))].join("\n");
  return new Response(body + "\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="drop-signups.csv"`, "Cache-Control": "no-store" } });
}
