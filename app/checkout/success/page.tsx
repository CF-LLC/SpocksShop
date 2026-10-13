import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ClearCart } from "@/components/checkout/clear-cart";
import { EmptyState } from "@/components/ui/empty-state";
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

async function findOrder(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return null;
  try {
    const [row] = await db
      .select({ number: orders.orderNumber, status: orders.status, method: orders.fulfillmentMethod })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(eq(payments.providerPaymentId, sessionId));
    return row ?? null;
  } catch {
    return null;
  }
}

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const order = await findOrder((await searchParams).session_id ?? "");
  if (!order) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <EmptyState icon="🔭" title="We couldn't find that order" body="If you were charged, you'll get a receipt from Stripe by email. Contact us with it and we'll sort it out." actions={[{ href: "/contact", label: "Contact us" }, { href: "/shop", label: "Back to the shop" }]} />
      </div>
    );
  }
  const paid = order.status === "paid" || order.status === "paid_review";
  return (
    <div className="mx-auto max-w-xl py-6 text-center">
      <ClearCart />
      <p className="text-5xl" aria-hidden>🖖</p>
      <h1 className="t-h1 mt-4">{paid ? "Thank you! Order confirmed." : "Thanks! We're confirming your payment."}</h1>
      <p className="muted mt-3">Order <strong className="text-[var(--text)]">{order.number}</strong>. Stripe emails your receipt.</p>
      <p className="muted mt-2">
        {order.method === "pickup" ? "We'll email you to set a pickup time in Bentonville." : "We'll email tracking when it ships."}
        {!paid ? " This page updates once Stripe confirms; refresh in a minute." : ""}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/shop" className="btn btn-primary">Keep shopping</Link>
        <Link href="/contact" className="btn btn-outline">Questions?</Link>
      </div>
    </div>
  );
}
