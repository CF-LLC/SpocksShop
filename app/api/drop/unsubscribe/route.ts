import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { verifyUnsub } from "@/lib/drop/unsubscribe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Unsubscribe from Daily Drop emails. Accepts the signed link's e + t as JSON, form fields or query params,
 * so it also works as an RFC 8058 one-click List-Unsubscribe-Post target. Always idempotent.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let e: unknown = url.searchParams.get("e"), t: unknown = url.searchParams.get("t");
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const b = (await request.json().catch(() => null)) as { e?: unknown; t?: unknown } | null;
    if (b) { e = b.e ?? e; t = b.t ?? t; }
  } else if (type.includes("form")) {
    const f = await request.formData().catch(() => null);
    if (f) { e = f.get("e") ?? e; t = f.get("t") ?? t; }
  }
  const email = verifyUnsub(e, t);
  if (!email) return NextResponse.json({ error: "This unsubscribe link isn't valid. Email support@spockshop.com and we'll remove you." }, { status: 400 });
  try {
    await db.execute(sql`update drop_signups set unsubscribed=true, unsubscribed_at=coalesce(unsubscribed_at, now()) where email=${email}`);
  } catch (err) {
    console.error("drop unsubscribe failed", { message: String((err as Error)?.message).slice(0, 200) });
    return NextResponse.json({ error: "Couldn't update just now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
