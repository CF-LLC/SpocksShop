import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPaid, markProcessing, releaseOrder } from "@/lib/checkout/fulfill";
import { handleStripeEvent } from "@/lib/checkout/webhook";
import { onApprovalAsyncPayment, onApprovalCheckoutCompleted } from "@/lib/approval/service";
import { getMailer } from "@/lib/mail";
import { getStripe, stripeSettings } from "@/lib/stripe";
import { handleAiBillingEvent } from "@/lib/ai/billing";
import { aiBillingOps } from "@/lib/ai/billing-db";
import { sellerBillingEnabled } from "@/lib/ai/entitlement";
import { onChargeEvent, recordSellerPayout } from "@/lib/marketplace/service";

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
    // Seller AI credit packs / plans (only when AI_SELLER_BILLING_ENABLED=true). Not ours -> fall through to orders.
    if (sellerBillingEnabled()) {
      const ai = await handleAiBillingEvent(event, aiBillingOps);
      if (ai.handled) {
        console.info("stripe webhook ai billing", { type: event.type, id: event.id, result: ai.result });
        return NextResponse.json({ received: true });
      }
    }
    // Marketplace: refunds/disputes on seller orders hold or cancel the pending payout (no-op for shop orders).
    const charge = await onChargeEvent({ db, stripe }, event);
    if (charge.handled) {
      console.info("stripe webhook charge", { type: event.type, id: event.id, result: charge.result });
      return NextResponse.json({ received: true });
    }
    const outcome = await handleStripeEvent(event, {
      markPaid: async (id, session) => {
        const r = await markPaid(db, id, session);
        if (r === "updated") {
          const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
          await recordSellerPayout({ db, stripe }, id, pi);
        }
        return r;
      },
      markProcessing: (id) => markProcessing(db, id),
      release: (id, reason) => releaseOrder(db, id, reason),
      awaitApproval: (id, session) => onApprovalCheckoutCompleted({ db, stripe, mailer: getMailer() }, id, session),
      approvalAsync: (id, outcome) => onApprovalAsyncPayment({ db, stripe, mailer: getMailer() }, id, outcome),
    });
    if (outcome.handled) console.info("stripe webhook", { type: event.type, id: event.id, result: outcome.result });
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 makes Stripe retry; handlers are idempotent.
    console.error("stripe webhook failed", { type: event.type, id: event.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
