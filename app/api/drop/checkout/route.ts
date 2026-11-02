import { NextResponse } from "next/server";
import { dropEnabled, isHeld } from "@/lib/drop/config";
import { buildSessionParams, parseCart, promoApplies } from "@/lib/drop/core";
import { normalizeCode } from "@/lib/drop/signup";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/public-url";
import { getStripe } from "@/lib/stripe";
import { getSession } from "@/lib/auth/session";

/** Only a verified, non-revoked admin session (signed cookie + revocation check). Never a client flag. */
async function isVerifiedAdmin() {
  try {
    return (await getSession())?.role === "admin";
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!dropEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Checkout is temporarily unavailable." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { items?: unknown; code?: unknown } | null;
  const lines = parseCart(body?.items);
  if (!lines || lines.some((l) => isHeld(l.slug))) return NextResponse.json({ error: "That item or size isn't available." }, { status: 400 });
  const origin = publicUrl(request, "/").origin;
  const adminTest = await isVerifiedAdmin();
  let promoCode: string | null = null;
  if (body?.code != null && body.code !== "" && !adminTest) {
    const code = normalizeCode(body.code);
    const rows = code ? ((await db.execute(sql`select redeemed_at from drop_signups where code=${code}`)) as unknown as { redeemed_at: string | null }[]) : [];
    if (!rows[0]) return NextResponse.json({ error: "That code isn't valid.", codeError: true }, { status: 400 });
    if (rows[0].redeemed_at) return NextResponse.json({ error: "That code was already used.", codeError: true }, { status: 400 });
    if (!promoApplies(lines)) return NextResponse.json({ error: "The 10% code doesn't apply to this cart (deal-priced items, stickers and 2XL are excluded). Remove the code to check out.", codeError: true }, { status: 400 });
    promoCode = code;
  }
  try {
    const session = await stripe.checkout.sessions.create(buildSessionParams(lines, origin, process.env, { adminTest, promoCode }));
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("drop checkout failed", { message: String((e as Error)?.message).slice(0, 200) });
    return NextResponse.json({ error: "Checkout couldn't start. Please try again in a minute." }, { status: 502 });
  }
}
