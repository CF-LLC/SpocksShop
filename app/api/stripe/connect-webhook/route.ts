import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe, stripeSettings } from "@/lib/stripe";
import { marketplaceSettings } from "@/lib/marketplace/config";
import { syncConnectAccount } from "@/lib/marketplace/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const V1_TYPES = new Set(["account.updated"]);

/**
 * Connected-account status sync. Accepts either a v1 Connect endpoint (account.updated, signed with
 * STRIPE_CONNECT_WEBHOOK_SECRET) or a v2 thin event destination (v2.core.account*, signed with
 * STRIPE_CONNECT_THIN_WEBHOOK_SECRET). Either way we re-fetch the account; payloads are never trusted.
 */
export async function POST(request: Request) {
  const market = marketplaceSettings();
  if (!market.enabled) return new NextResponse("Not found", { status: 404 });
  const stripe = getStripe();
  if (!stripe || (!market.connectWebhookSecret && !market.connectThinWebhookSecret)) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  const payload = await request.text();

  let accountId: string | null = null;
  let kind = "";
  let livemode: boolean | undefined;
  let verified = false;
  if (market.connectWebhookSecret) {
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, market.connectWebhookSecret);
      verified = true;
      kind = event.type;
      livemode = event.livemode;
      if (V1_TYPES.has(event.type)) accountId = event.account ?? (event.data.object as { id?: string }).id ?? null;
    } catch { /* try thin */ }
  }
  if (!verified && market.connectThinWebhookSecret) {
    try {
      const note = stripe.parseEventNotification(payload, signature, market.connectThinWebhookSecret);
      verified = true;
      kind = note.type;
      livemode = note.livemode;
      if (note.type.startsWith("v2.core.account")) accountId = (note as { related_object?: { id?: string } | null }).related_object?.id ?? null;
    } catch { /* invalid */ }
  }
  if (!verified) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });

  const mode = stripeSettings().mode;
  if (mode && typeof livemode === "boolean" && livemode !== (mode === "live")) return NextResponse.json({ received: true, ignored: "mode_mismatch" });
  if (!accountId) return NextResponse.json({ received: true, ignored: kind });
  try {
    const r = await syncConnectAccount({ db, stripe }, accountId);
    console.info("connect webhook", { type: kind, matched: r.matched, status: r.connectStatus });
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("connect webhook failed", { type: kind, error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
