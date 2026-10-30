import { NextResponse } from "next/server";
import { dropEnabled } from "@/lib/drop/config";
import { buildSessionParams, parseCart } from "@/lib/drop/core";
import { publicUrl } from "@/lib/public-url";
import { getStripe } from "@/lib/stripe";

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
    const session = await stripe.checkout.sessions.create(buildSessionParams(lines, origin));
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("drop checkout failed", { message: String((e as Error)?.message).slice(0, 200) });
    return NextResponse.json({ error: "Checkout couldn't start. Please try again in a minute." }, { status: 502 });
  }
}
