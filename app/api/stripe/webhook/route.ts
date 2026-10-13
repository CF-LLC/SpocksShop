import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPaid, markProcessing, releaseOrder } from "@/lib/checkout/fulfill";
import { handleStripeEvent } from "@/lib/checkout/webhook";
import { getStripe, stripeSettings } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const settings = stripeSettings();
  const stripe = getStripe();
  if (!stripe || !settings.webhookSecret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  // Signature is computed over the exact raw bytes.
  const payload = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, settings.webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Refuse test-mode events on a live key (and vice versa) so a misrouted endpoint can't mark orders paid.
  if (settings.mode && typeof event.livemode === "boolean" && event.livemode !== (settings.mode === "live")) {
    console.warn("stripe webhook mode mismatch", { id: event.id, livemode: event.livemode, keyMode: settings.mode });
    return NextResponse.json({ received: true, ignored: "mode_mismatch" });
  }

  try {
    const outcome = await handleStripeEvent(event, {
      markPaid: (id, session) => markPaid(db, id, session),
      markProcessing: (id) => markProcessing(db, id),
      release: (id, reason) => releaseOrder(db, id, reason),
    });
    if (outcome.handled) console.info("stripe webhook", { type: event.type, id: event.id, result: outcome.result });
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 makes Stripe retry; handlers are idempotent.
    console.error("stripe webhook failed", { type: event.type, id: event.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
