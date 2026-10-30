import { NextResponse } from "next/server";
import { dropEnabled } from "@/lib/drop/config";
import { buildSessionParams, parseCart } from "@/lib/drop/core";
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
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  const lines = parseCart(body?.items);
  if (!lines) return NextResponse.json({ error: "That item or size isn't available." }, { status: 400 });
  const origin = publicUrl(request, "/").origin;
  try {
    const session = await stripe.checkout.sessions.create(buildSessionParams(lines, origin, process.env, { adminTest: await isVerifiedAdmin() }));
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("drop checkout failed", { message: String((e as Error)?.message).slice(0, 200) });
    return NextResponse.json({ error: "Checkout couldn't start. Please try again in a minute." }, { status: 502 });
  }
}
