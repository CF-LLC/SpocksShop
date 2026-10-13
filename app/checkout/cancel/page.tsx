import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";
import { releaseOrder } from "@/lib/checkout/fulfill";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Checkout canceled", robots: { index: false } };

/** Shopper backed out of Stripe: expire their session so the held stock frees up right away. */
async function releaseHold(orderNumber: string) {
  if (!/^SPK-\d{8}-[0-9A-F]{6}$/.test(orderNumber)) return;
  const stripe = getStripe();
  if (!stripe) return;
  try {
    const [row] = await db
      .select({ orderId: orders.id, sessionId: payments.providerPaymentId })
      .from(orders)
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .where(and(eq(orders.orderNumber, orderNumber), eq(orders.status, "pending")));
    if (!row?.sessionId) return;
    const session = await stripe.checkout.sessions.expire(row.sessionId);
    // Only release once Stripe confirms the session can no longer be paid; the expired webhook is then a no-op.
    if (session.status === "expired") await releaseOrder(db, row.orderId, "canceled");
  } catch {
    // Already completed or expired: the webhook owns the outcome.
  }
}

export default async function CancelPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  await releaseHold((await searchParams).order ?? "");
  return (
    <div className="mx-auto max-w-xl py-6 text-center">
      <p className="text-5xl" aria-hidden>🛰️</p>
      <h1 className="t-h1 mt-4">Checkout canceled</h1>
      <p className="muted mt-3">No payment was taken. Your cart is still saved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/checkout" className="btn btn-primary">Return to checkout</Link>
        <Link href="/shop" className="btn btn-outline">Keep shopping</Link>
      </div>
    </div>
  );
}
