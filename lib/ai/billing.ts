import type Stripe from "stripe";
import { sellerBillingEnabled } from "./entitlement";

/**
 * Seller AI billing (stubbed, off by default). Nothing here creates Stripe products/prices:
 * create them in the Dashboard later and set the env price ids.
 *   AI_SELLER_BILLING_ENABLED=true
 *   STRIPE_PRICE_AI_CREDIT_PACK   one-time price for a pack of AI_CREDIT_PACK_SIZE suggestions (Checkout, mode=payment)
 *   STRIPE_PRICE_AI_PLAN_MONTHLY  recurring monthly price (Checkout, mode=subscription), optional
 */
type Env = Record<string, string | undefined>;
export type AiBillingSettings = { enabled: boolean; creditPackPrice: string | null; planPrice: string | null; packSize: number };

export function aiBillingSettings(env: Env = process.env): AiBillingSettings {
  const size = Number(env.AI_CREDIT_PACK_SIZE);
  return {
    enabled: sellerBillingEnabled(env),
    creditPackPrice: env.STRIPE_PRICE_AI_CREDIT_PACK?.trim() || null,
    planPrice: env.STRIPE_PRICE_AI_PLAN_MONTHLY?.trim() || null,
    packSize: Number.isInteger(size) && size > 0 ? size : 25,
  };
}

export type AiPurchaseKind = "credits" | "plan";

/** Build Checkout params, or explain why it's unavailable. Pure, so it's testable without Stripe. */
export function buildAiCheckoutParams(
  kind: AiPurchaseKind,
  seller: { sellerId: string; email: string },
  origin: string,
  s: AiBillingSettings,
): { ok: true; params: Stripe.Checkout.SessionCreateParams } | { ok: false; reason: string } {
  if (!s.enabled) return { ok: false, reason: "AI billing for sellers is not enabled." };
  const price = kind === "credits" ? s.creditPackPrice : s.planPrice;
  if (!price) return { ok: false, reason: `No Stripe price configured for ${kind === "credits" ? "the credit pack" : "the monthly plan"}.` };
  const metadata = { kind: kind === "credits" ? "ai_credits" : "ai_plan", seller_id: seller.sellerId, credits: String(kind === "credits" ? s.packSize : 0) };
  const base = {
    line_items: [{ price, quantity: 1 }],
    customer_email: seller.email,
    client_reference_id: seller.sellerId,
    metadata,
    success_url: `${origin}/sell?ai=thanks`,
    cancel_url: `${origin}/sell?ai=cancelled`,
  };
  return kind === "credits"
    ? { ok: true, params: { ...base, mode: "payment" } }
    : { ok: true, params: { ...base, mode: "subscription", subscription_data: { metadata } } };
}

export type AiBillingOps = {
  /** Must be idempotent on `reference` (unique column), so webhook retries can't double-credit. */
  grantCredits(sellerId: string, credits: number, reference: string): Promise<void>;
  setPlan(sellerId: string, p: { status: string; subscriptionId: string | null; customerId: string | null; periodEnd: Date | null }): Promise<void>;
};

export const AI_BILLING_EVENTS = ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOf = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as { id: string }).id) : null);

/** Handle AI billing events. Returns handled:false for anything that isn't ours (orders keep their own handler). */
export async function handleAiBillingEvent(event: Stripe.Event, ops: AiBillingOps): Promise<{ handled: boolean; result?: string }> {
  const obj = event.data.object as { metadata?: Record<string, string> | null };
  const kind = obj.metadata?.kind;
  const sellerId = obj.metadata?.seller_id;
  if (kind !== "ai_credits" && kind !== "ai_plan") return { handled: false };
  if (!sellerId || !UUID.test(sellerId)) return { handled: true, result: "bad_metadata" };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (kind === "ai_credits") {
      if (session.payment_status !== "paid") return { handled: true, result: "unpaid" };
      const credits = Number(session.metadata?.credits);
      if (!Number.isInteger(credits) || credits <= 0) return { handled: true, result: "bad_metadata" };
      await ops.grantCredits(sellerId, credits, session.id);
      return { handled: true, result: "credited" };
    }
    await ops.setPlan(sellerId, { status: "active", subscriptionId: idOf(session.subscription), customerId: idOf(session.customer), periodEnd: null });
    return { handled: true, result: "plan_active" };
  }
  if ((event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") && kind === "ai_plan") {
    const sub = event.data.object as Stripe.Subscription & { current_period_end?: number };
    const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
    const end = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
    await ops.setPlan(sellerId, { status, subscriptionId: sub.id, customerId: idOf(sub.customer), periodEnd: end ? new Date(end * 1000) : null });
    return { handled: true, result: `plan_${status}` };
  }
  return { handled: false };
}
