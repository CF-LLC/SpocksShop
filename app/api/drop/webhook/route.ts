import { NextResponse } from "next/server";
import { dropEnabled, printfulAutoConfirm } from "@/lib/drop/config";
import { handleDropEvent } from "@/lib/drop/core";
import { dropDeps } from "@/lib/drop/store";
import { publicUrl } from "@/lib/public-url";
import { getStripe, stripeSettings } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Separate Stripe endpoint for the Daily Drop (own signing secret DROP_STRIPE_WEBHOOK_SECRET). */
export async function POST(request: Request) {
  if (!dropEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const stripe = getStripe();
  const secret = process.env.DROP_STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  const payload = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  const mode = stripeSettings().mode;
  if (mode && event.livemode !== (mode === "live")) return NextResponse.json({ received: true, ignored: "mode_mismatch" });
  const artBase = process.env.DROP_ART_BASE_URL?.trim() || publicUrl(request, "/").origin;
  const result = await handleDropEvent(event, dropDeps, { artBase, autoConfirm: printfulAutoConfirm() });
  console.info("drop webhook", { id: event.id, type: event.type, result });
  return NextResponse.json({ received: true, result });
}
