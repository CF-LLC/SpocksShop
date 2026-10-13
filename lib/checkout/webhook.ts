import type Stripe from "stripe";
import type { FulfillResult } from "./fulfill";

export type FulfillOps = {
  markPaid(orderId: string, session: Stripe.Checkout.Session): Promise<FulfillResult>;
  markProcessing(orderId: string): Promise<FulfillResult>;
  release(orderId: string, reason: "expired" | "failed"): Promise<FulfillResult>;
};

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function orderIdFrom(session: Stripe.Checkout.Session): string | null {
  const id = session.metadata?.order_id ?? session.client_reference_id ?? null;
  return id && UUID.test(id) ? id : null;
}

/** Route a verified Stripe event to the order state machine. Unknown events are acknowledged and ignored. */
export async function handleStripeEvent(event: Stripe.Event, ops: FulfillOps): Promise<{ handled: boolean; result?: FulfillResult; orderId?: string }> {
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return { handled: false };
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = orderIdFrom(session);
  if (!orderId) return { handled: true, result: "not_found" };
  switch (event.type) {
    case "checkout.session.completed":
      return { handled: true, orderId, result: session.payment_status === "unpaid" ? await ops.markProcessing(orderId) : await ops.markPaid(orderId, session) };
    case "checkout.session.async_payment_succeeded":
      return { handled: true, orderId, result: await ops.markPaid(orderId, session) };
    case "checkout.session.async_payment_failed":
      return { handled: true, orderId, result: await ops.release(orderId, "failed") };
    case "checkout.session.expired":
      return { handled: true, orderId, result: await ops.release(orderId, "expired") };
    default:
      return { handled: false };
  }
}
