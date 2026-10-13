import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createCheckout } from "@/lib/checkout/create";
import { checkoutInputSchema, CheckoutError } from "@/lib/checkout/core";
import { publicUrl } from "@/lib/public-url";
import { isSameOrigin } from "@/lib/same-origin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Checkout is coming soon.", comingSoon: true }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = checkoutInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid cart." }, { status: 400 });

  try {
    const origin = publicUrl(request, "/").origin;
    const { url, orderNumber } = await createCheckout({ db, stripe, origin }, parsed.data);
    return NextResponse.json({ url, orderNumber });
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("checkout failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Checkout failed. Nothing was charged." }, { status: 500 });
  }
}
