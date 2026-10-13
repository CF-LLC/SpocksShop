import { and, eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { addresses, customers, inventory, orderItems, orders, payments, products } from "@/lib/db/schema";
import type { Database } from "./db";

/** Orders still holding a reservation. */
export const HOLDING = ["pending", "processing"] as const;

export type FulfillResult = "updated" | "duplicate" | "not_found" | "needs_review";

async function lockOrder(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  return order;
}

/**
 * Payment confirmed: turn the reservation into a sale exactly once.
 * Re-delivered webhooks find the order already paid and change nothing.
 */
export async function markPaid(database: Database, orderId: string, session: Stripe.Checkout.Session): Promise<FulfillResult> {
  return database.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return "not_found";
    if (!(HOLDING as readonly string[]).includes(order.status)) return order.status === "canceled" ? markLatePayment(tx, order.id, session) : "duplicate";

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const it of items) {
      if (!it.productId) continue;
      await tx
        .update(inventory)
        .set({
          quantityReserved: sql`greatest(${inventory.quantityReserved} - ${it.quantity}, 0)`,
          quantityOnHand: sql`greatest(${inventory.quantityOnHand} - ${it.quantity}, 0)`,
          quantitySold: sql`${inventory.quantitySold} + ${it.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(inventory.productId, it.productId));
    }
    const ids = items.map((i) => i.productId).filter((v): v is string => Boolean(v));
    if (ids.length) {
      // One-of-a-kind items that hit zero leave the storefront.
      await tx
        .update(products)
        .set({ status: "sold", updatedAt: new Date() })
        .where(and(inArray(products.id, ids), sql`exists (select 1 from inventory i where i.product_id = ${products.id} and i.quantity_on_hand = 0)`));
    }

    const customerId = await upsertCustomer(tx, session);
    const shippingAddressId = order.fulfillmentMethod === "ship" ? await saveAddress(tx, customerId, session) : null;
    // With Stripe Tax on, amount_total = our total + tax; record the tax Stripe charged.
    const taxCents = session.total_details?.amount_tax ?? 0;
    const amountMatches = session.amount_total == null || session.amount_total === order.totalCents + taxCents;
    await tx
      .update(orders)
      .set({
        status: amountMatches ? "paid" : "paid_review",
        ...(taxCents > 0 && amountMatches ? { taxCents, totalCents: order.totalCents + taxCents } : {}),
        customerId: customerId ?? order.customerId,
        shippingAddressId: shippingAddressId ?? order.shippingAddressId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    await tx
      .update(payments)
      .set({ paymentStatus: "succeeded", amountCents: session.amount_total ?? order.totalCents, updatedAt: new Date() })
      .where(and(eq(payments.orderId, order.id), eq(payments.providerPaymentId, session.id)));
    return amountMatches ? "updated" : "needs_review";
  });
}

/** Paid after the hold was released (should not happen with card-only sessions): flag it for Cooper, don't touch stock. */
async function markLatePayment(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], orderId: string, session: Stripe.Checkout.Session): Promise<FulfillResult> {
  await tx.update(orders).set({ status: "paid_review", updatedAt: new Date() }).where(eq(orders.id, orderId));
  await tx.update(payments).set({ paymentStatus: "succeeded", updatedAt: new Date() }).where(and(eq(payments.orderId, orderId), eq(payments.providerPaymentId, session.id)));
  return "needs_review";
}

/** Delayed payment method submitted but not settled yet: keep holding the stock. */
export async function markProcessing(database: Database, orderId: string): Promise<FulfillResult> {
  const updated = await database
    .update(orders)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return updated.length ? "updated" : "duplicate";
}

/** Session expired, failed or was abandoned: give the reserved stock back, once. */
export async function releaseOrder(database: Database, orderId: string, reason: "expired" | "failed" | "canceled"): Promise<FulfillResult> {
  return database.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return "not_found";
    if (!(HOLDING as readonly string[]).includes(order.status)) return "duplicate";
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const it of items) {
      if (!it.productId) continue;
      await tx
        .update(inventory)
        .set({ quantityReserved: sql`greatest(${inventory.quantityReserved} - ${it.quantity}, 0)`, updatedAt: new Date() })
        .where(eq(inventory.productId, it.productId));
    }
    await tx.update(orders).set({ status: "canceled", updatedAt: new Date() }).where(eq(orders.id, order.id));
    await tx.update(payments).set({ paymentStatus: reason, updatedAt: new Date() }).where(and(eq(payments.orderId, order.id), eq(payments.paymentStatus, "pending")));
    return "updated";
  });
}

async function upsertCustomer(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], session: Stripe.Checkout.Session): Promise<string | null> {
  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) return null;
  const name = session.customer_details?.name ?? null;
  const [row] = await tx
    .insert(customers)
    .values({ email, name })
    .onConflictDoUpdate({ target: customers.email, set: { name: sql`coalesce(${customers.name}, excluded.name)`, updatedAt: new Date() } })
    .returning({ id: customers.id });
  return row.id;
}

async function saveAddress(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], customerId: string | null, session: Stripe.Checkout.Session): Promise<string | null> {
  const ship = session.collected_information?.shipping_details;
  const a = ship?.address;
  if (!a?.line1 || !a.city || !a.state || !a.postal_code) return null;
  const [row] = await tx
    .insert(addresses)
    .values({ customerId, kind: "shipping", name: ship?.name ?? null, line1: a.line1, line2: a.line2 ?? null, city: a.city, state: a.state, postalCode: a.postal_code, country: a.country ?? "US" })
    .returning({ id: addresses.id });
  return row.id;
}
