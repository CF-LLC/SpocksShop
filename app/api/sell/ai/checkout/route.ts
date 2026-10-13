import { NextResponse } from "next/server";
import { getSellerSession } from "@/lib/auth/seller-session";
import { aiBillingSettings, buildAiCheckoutParams } from "@/lib/ai/billing";
import { getStripe, siteOrigin } from "@/lib/stripe";

export const runtime = "nodejs";

/** Stub: seller buys an AI credit pack (kind=credits) or the monthly plan (kind=plan). Off unless configured. */
export async function POST(request: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind") === "plan" ? "plan" : "credits";
  const origin = siteOrigin();
  if (!origin) return NextResponse.json({ error: "APP_URL is not set." }, { status: 503 });
  const built = buildAiCheckoutParams(kind, { sellerId: session.sellerId, email: session.email }, origin, aiBillingSettings());
  if (!built.ok) return NextResponse.json({ error: built.reason }, { status: 503 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Payments aren't configured." }, { status: 503 });
  const checkout = await stripe.checkout.sessions.create(built.params);
  return NextResponse.json({ url: checkout.url });
}
