import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dropEnabled } from "@/lib/drop/config";
import { CONSENT_TEXT, hashIp, makeCode, normalizeEmail, rateLimited } from "@/lib/drop/signup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Capture only: stores the email + a one-use 10% code and shows it on screen. Sends no email. */
export async function POST(request: Request) {
  if (!dropEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { email?: unknown; consent?: unknown; website?: unknown; source?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Please enter your email." }, { status: 400 });
  // Honeypot: bots fill the hidden "website" field. Pretend success, store nothing.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true, code: null });
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip, process.env.SESSION_SECRET ?? "");
  if (rateLimited(ipHash)) return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Please tick the box to agree to Daily Drop emails." }, { status: 400 });
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : null;
  try {
    const recent = (await db.execute(sql`select count(*)::int as n from drop_signups where ip_hash=${ipHash} and created_at > now() - interval '1 hour'`)) as unknown as { n: number }[];
    if ((recent[0]?.n ?? 0) >= 10) return NextResponse.json({ error: "Too many tries. Please wait a while." }, { status: 429 });
    for (let attempt = 0; attempt < 3; attempt++) {
      const rows = (await db.execute(sql`insert into drop_signups (email, code, source, consent_text, ip_hash)
        values (${email}, ${makeCode()}, ${source}, ${CONSENT_TEXT}, ${ipHash})
        on conflict (email) do update set unsubscribed=false, unsubscribed_at=null
        returning code, redeemed_at, (xmax <> 0) as existed`)) as unknown as { code: string; redeemed_at: string | null; existed: boolean }[];
      const r = rows[0];
      if (!r) continue;
      if (r.redeemed_at) return NextResponse.json({ ok: true, already: true, used: true, code: null });
      return NextResponse.json({ ok: true, already: r.existed, code: r.code });
    }
  } catch (e) {
    if (!/duplicate key/.test(String((e as Error)?.message))) console.error("drop signup failed", { message: String((e as Error)?.message).slice(0, 200) });
  }
  return NextResponse.json({ error: "Couldn't sign you up just now. Please try again." }, { status: 500 });
}
