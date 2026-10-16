import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { inventory, orderItems, orders, payments, products, refunds } from "@/lib/db/schema";
import type { Database, Tx } from "@/lib/checkout/db";
import { HOLDING, saveAddress, upsertCustomer } from "@/lib/checkout/fulfill";
import { ownerEmail, sendSafe, type Mailer } from "@/lib/mail";
import {
  AWAITING, CAPTURING, DECLINING, HOLD_MS, PENDING_APPROVAL, acceptAction, declineAction, holdAction, paymentRowStatus, paymentStateOf,
  mailCustomerConfirmed, mailCustomerDeclined, mailCustomerReceived, mailOwnerExpired, mailOwnerNewOrder, mailOwnerReminder,
  type ApprovalResult, type OrderSummary, type PaymentState,
} from "./core";

type Env = Record<string, string | undefined>;
export type ApprovalDeps = { db: Database; stripe: Stripe | null; mailer: Mailer; env?: Env; now?: () => Date };
type StripeLike = Pick<Stripe, "paymentIntents" | "refunds">;

const nowOf = (d: ApprovalDeps) => (d.now ? d.now() : new Date());
const originOf = (env: Env) => (env.APP_URL?.trim() || "https://spockshop.com").replace(/\/$/, "");

async function lockOrder(tx: Tx, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  return order;
}

export async function orderSummary(database: Database | Tx, orderId: string): Promise<OrderSummary | null> {
  const [o] = await database.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return null;
  const items = await database.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const pays = await database.select({ status: payments.paymentStatus }).from(payments).where(eq(payments.orderId, orderId));
  const charged = pays.some((p) => p.status === "succeeded" || p.status === "refunded");
  return { orderNumber: o.orderNumber, totalCents: o.totalCents, items: items.map((i) => (i.quantity > 1 ? `${i.titleSnapshot} x${i.quantity}` : i.titleSnapshot)), customerEmail: o.customerEmail, holdExpiresAt: o.holdExpiresAt, fulfillmentMethod: o.fulfillmentMethod, charged };
}

/** Hide fully-held items from the shop. Called inside the transaction that took the reservation. */
async function hideHeld(tx: Tx, productIds: string[]) {
  if (!productIds.length) return;
  await tx
    .update(products)
    .set({ status: PENDING_APPROVAL, updatedAt: new Date() })
    .where(and(inArray(products.id, productIds), eq(products.status, "listed"), sql`exists (select 1 from inventory i where i.product_id = ${products.id} and i.quantity_on_hand - i.quantity_reserved <= 0)`));
}

/** Give held stock back and relist items that were hidden for approval. */
async function releaseHeld(tx: Tx, orderId: string) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.productId));
  for (const it of items) {
    if (!it.productId) continue;
    await tx.update(inventory).set({ quantityReserved: sql`greatest(${inventory.quantityReserved} - ${it.quantity}, 0)`, updatedAt: new Date() }).where(eq(inventory.productId, it.productId));
  }
  const ids = items.map((i) => i.productId).filter((v): v is string => Boolean(v));
  if (ids.length) await tx.update(products).set({ status: "listed", updatedAt: new Date() }).where(and(inArray(products.id, ids), eq(products.status, PENDING_APPROVAL)));
}

/**
 * Re-take a reservation for an order whose hold was already released (stale-pending sweep raced the webhook).
 * Row locks + the inventory_reserved_lte_on_hand check make it impossible to hold the same unit twice.
 */
async function retakeHold(tx: Tx, orderId: string): Promise<boolean> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.productId));
  const ids = items.map((i) => i.productId).filter((v): v is string => Boolean(v));
  if (ids.length !== items.length) return false;
  const stock = await tx.select().from(inventory).where(inArray(inventory.productId, ids)).orderBy(asc(inventory.productId)).for("update");
  const prods = await tx.select({ id: products.id, status: products.status }).from(products).where(inArray(products.id, ids));
  for (const it of items) {
    const s = stock.find((r) => r.productId === it.productId);
    const p = prods.find((r) => r.id === it.productId);
    if (!s || !p || p.status !== "listed" || s.quantityOnHand - s.quantityReserved < it.quantity) return false;
  }
  for (const it of items) await tx.update(inventory).set({ quantityReserved: sql`${inventory.quantityReserved} + ${it.quantity}`, updatedAt: new Date() }).where(eq(inventory.productId, it.productId!));
  return true;
}

const piId = (session: Stripe.Checkout.Session) => (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null);

/**
 * checkout.session.completed for a manual-capture order: card authorized, not charged.
 * Holds the item (hidden from shop), records the PaymentIntent and starts the 6-day clock. Exactly once per order.
 */
export async function markAwaitingApproval(database: Database, orderId: string, session: Stripe.Checkout.Session, now = new Date(), state: PaymentState = sessionPaymentState(session)): Promise<ApprovalResult> {
  return database.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return "not_found";
    if (!(HOLDING as readonly string[]).includes(order.status)) {
      if (order.status !== "canceled" || order.paymentIntentId) return "duplicate";
      // Our hold lapsed before Stripe told us. Only continue if the item is still free.
      if (!(await retakeHold(tx, order.id))) {
        await tx.update(orders).set({ paymentIntentId: piId(session), customerEmail: session.customer_details?.email?.trim().toLowerCase() ?? null, decisionReason: "sold_out_before_authorization", updatedAt: now }).where(eq(orders.id, order.id));
        return "conflict";
      }
    }
    const items = await tx.select({ productId: orderItems.productId }).from(orderItems).where(eq(orderItems.orderId, order.id));
    await hideHeld(tx, items.map((i) => i.productId).filter((v): v is string => Boolean(v)));
    const customerId = await upsertCustomer(tx, session);
    const shippingAddressId = order.fulfillmentMethod === "ship" ? await saveAddress(tx, customerId, session) : null;
    if (session.amount_total != null && session.amount_total !== order.totalCents + (session.total_details?.amount_tax ?? 0)) {
      console.warn("approval order amount mismatch", { order: order.orderNumber });
    }
    await tx
      .update(orders)
      .set({
        status: AWAITING,
        requiresApproval: true,
        paymentIntentId: piId(session),
        customerEmail: session.customer_details?.email?.trim().toLowerCase() ?? null,
        customerId: customerId ?? order.customerId,
        shippingAddressId: shippingAddressId ?? order.shippingAddressId,
        authorizedAt: now,
        holdExpiresAt: new Date(now.getTime() + HOLD_MS),
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await tx.update(payments).set({ paymentStatus: paymentRowStatus(state), amountCents: session.amount_total ?? order.totalCents, updatedAt: now }).where(and(eq(payments.orderId, order.id), eq(payments.providerPaymentId, session.id)));
    return "updated";
  });
}

/** Best guess without calling Stripe: "paid" = captured now (crypto), otherwise a hold. */
export function sessionPaymentState(session: Stripe.Checkout.Session): PaymentState {
  return session.payment_status === "paid" ? "charged" : "held";
}

/** Ask Stripe where the money is (held / captured / still settling). Falls back to the session when Stripe is unreachable. */
async function intentState(stripe: StripeLike | null, pi: string | null, session?: Stripe.Checkout.Session): Promise<PaymentState> {
  if (stripe && pi) {
    try {
      return paymentStateOf((await stripe.paymentIntents.retrieve(pi)).status);
    } catch (error) {
      console.error("payment intent lookup failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return session ? sessionPaymentState(session) : "unknown";
}

/**
 * Delayed-settlement method (e.g. ACH) on an approval order settled or failed after checkout.session.completed.
 * Succeeded: mark the payment captured (Accept then just confirms). Failed: release the item and close the order.
 */
export async function onApprovalAsyncPayment(deps: ApprovalDeps, orderId: string, outcome: "succeeded" | "failed"): Promise<ApprovalResult> {
  const now = nowOf(deps);
  if (outcome === "succeeded") {
    const rows = await deps.db.update(payments).set({ paymentStatus: "succeeded", updatedAt: now }).where(and(eq(payments.orderId, orderId), inArray(payments.paymentStatus, ["processing", "authorized", "pending"]))).returning({ id: payments.id });
    return rows.length ? "updated" : "duplicate";
  }
  const result = await deps.db.transaction(async (tx): Promise<ApprovalResult> => {
    const order = await lockOrder(tx, orderId);
    if (!order) return "not_found";
    if (order.status !== AWAITING && order.status !== DECLINING) return "duplicate";
    await releaseHeld(tx, orderId);
    await tx.update(orders).set({ status: "declined", decidedAt: now, decisionReason: "payment_failed", updatedAt: now }).where(eq(orders.id, orderId));
    await tx.update(payments).set({ paymentStatus: "failed", updatedAt: now }).where(and(eq(payments.orderId, orderId), inArray(payments.paymentStatus, ["processing", "authorized", "pending"])));
    return "updated";
  });
  const owner = ownerEmail(deps.env ?? process.env);
  if (result === "updated" && owner) {
    const s = await orderSummary(deps.db, orderId);
    if (s) await sendSafe(deps.mailer, { to: owner, tag: "approval-payment-failed", subject: `Order ${s.orderNumber}: payment failed`, text: `The buyer's bank payment for order ${s.orderNumber} failed, so the order was closed and the item(s) put back in the shop. Nothing to do.` });
  }
  return result;
}

/** Webhook entry: hold + emails (only on the first delivery). A lost race voids the authorization at once. */
export async function onApprovalCheckoutCompleted(deps: ApprovalDeps, orderId: string, session: Stripe.Checkout.Session): Promise<ApprovalResult> {
  const env = deps.env ?? process.env;
  const state = await intentState(deps.stripe, piId(session), session);
  const result = await markAwaitingApproval(deps.db, orderId, session, nowOf(deps), state);
  if (result === "updated") {
    const summary = await orderSummary(deps.db, orderId);
    const owner = ownerEmail(env);
    if (summary && owner) await sendSafe(deps.mailer, mailOwnerNewOrder(owner, summary, originOf(env)));
    if (summary?.customerEmail) await sendSafe(deps.mailer, mailCustomerReceived(summary));
  } else if (result === "conflict") {
    const pi = piId(session);
    if (pi && deps.stripe) {
      if (state === "charged") await refundIntent(deps.stripe, pi, orderId);
      else await voidIntent(deps.stripe, pi, orderId);
    }
    const summary = await orderSummary(deps.db, orderId);
    if (summary?.customerEmail) await sendSafe(deps.mailer, mailCustomerDeclined(summary, "conflict"));
  }
  return result;
}

async function voidIntent(stripe: StripeLike, pi: string, orderId: string): Promise<boolean> {
  try {
    await stripe.paymentIntents.cancel(pi, {}, { idempotencyKey: `approval-cancel-${orderId}` });
    return true;
  } catch (error) {
    try {
      const cur = await stripe.paymentIntents.retrieve(pi);
      if (cur.status === "canceled") return true;
    } catch { /* fall through */ }
    console.error("approval cancel failed", { orderId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * Full refund of a captured payment. Idempotent: reuses an existing non-failed refund on the PaymentIntent,
 * and the idempotency key makes a retried create return the same refund.
 */
export async function refundIntent(stripe: StripeLike, pi: string, orderId: string): Promise<{ id: string; amount: number; status: string } | null> {
  try {
    const existing = await stripe.refunds.list({ payment_intent: pi, limit: 10 });
    const live = existing.data.find((r) => r.status !== "failed" && r.status !== "canceled");
    if (live) return { id: live.id, amount: live.amount, status: live.status ?? "pending" };
    const r = await stripe.refunds.create({ payment_intent: pi, reason: "requested_by_customer", metadata: { order_id: orderId } }, { idempotencyKey: `approval-refund-${orderId}` });
    return { id: r.id, amount: r.amount, status: r.status ?? "pending" };
  } catch (error) {
    console.error("approval refund failed", { orderId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function captureIntent(stripe: StripeLike, pi: string, orderId: string): Promise<boolean> {
  try {
    await stripe.paymentIntents.capture(pi, {}, { idempotencyKey: `approval-capture-${orderId}` });
    return true;
  } catch (error) {
    try {
      const cur = await stripe.paymentIntents.retrieve(pi);
      if (cur.status === "succeeded") return true;
    } catch { /* fall through */ }
    console.error("approval capture failed", { orderId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/** Atomically move an open order into an in-flight state. Re-claiming the same in-flight state is allowed (retry after a crash). */
async function claim(database: Database, orderId: string, to: typeof CAPTURING | typeof DECLINING) {
  const [row] = await database
    .update(orders)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), inArray(orders.status, [AWAITING, to])))
    .returning({ id: orders.id, paymentIntentId: orders.paymentIntentId });
  return row ?? null;
}

async function unclaim(database: Database, orderId: string, from: string) {
  await database.update(orders).set({ status: AWAITING, updatedAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.status, from)));
}

async function settledResult(database: Database, orderId: string, done: readonly string[]): Promise<ApprovalResult> {
  const [o] = await database.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  if (!o) return "not_found";
  return done.includes(o.status) ? "duplicate" : "not_awaiting";
}

/** Accept: capture the authorization, sell the item, email the buyer. Idempotent. */
export async function acceptOrder(deps: ApprovalDeps, orderId: string): Promise<ApprovalResult> {
  if (!deps.stripe) return "stripe_unavailable";
  const claimed = await claim(deps.db, orderId, CAPTURING);
  if (!claimed) return settledResult(deps.db, orderId, ["paid", "paid_review"]);
  const action = claimed.paymentIntentId ? acceptAction(await intentState(deps.stripe, claimed.paymentIntentId)) : "error";
  if (action === "wait") {
    await unclaim(deps.db, orderId, CAPTURING);
    return "payment_processing";
  }
  // "none": already captured at checkout (crypto, settled ACH), so there's nothing to capture.
  if (action === "error" || (action === "capture" && !(await captureIntent(deps.stripe, claimed.paymentIntentId!, orderId)))) {
    await unclaim(deps.db, orderId, CAPTURING);
    return "stripe_error";
  }
  const now = nowOf(deps);
  const result = await deps.db.transaction(async (tx): Promise<ApprovalResult> => {
    const order = await lockOrder(tx, orderId);
    if (!order || order.status !== CAPTURING) return "duplicate";
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.productId));
    for (const it of items) {
      if (!it.productId) continue;
      await tx
        .update(inventory)
        .set({
          quantityReserved: sql`greatest(${inventory.quantityReserved} - ${it.quantity}, 0)`,
          quantityOnHand: sql`greatest(${inventory.quantityOnHand} - ${it.quantity}, 0)`,
          quantitySold: sql`${inventory.quantitySold} + ${it.quantity}`,
          updatedAt: now,
        })
        .where(eq(inventory.productId, it.productId));
    }
    const ids = items.map((i) => i.productId).filter((v): v is string => Boolean(v));
    if (ids.length) {
      await tx.update(products).set({ status: "sold", updatedAt: now }).where(and(inArray(products.id, ids), sql`exists (select 1 from inventory i where i.product_id = ${products.id} and i.quantity_on_hand = 0)`));
      await tx.update(products).set({ status: "listed", updatedAt: now }).where(and(inArray(products.id, ids), eq(products.status, PENDING_APPROVAL)));
    }
    await tx.update(orders).set({ status: "paid", decidedAt: now, updatedAt: now }).where(eq(orders.id, orderId));
    await tx.update(payments).set({ paymentStatus: "succeeded", updatedAt: now }).where(and(eq(payments.orderId, orderId), inArray(payments.paymentStatus, ["authorized", "processing"])));
    return "updated";
  });
  if (result === "updated") {
    const s = await orderSummary(deps.db, orderId);
    if (s?.customerEmail) await sendSafe(deps.mailer, mailCustomerConfirmed(s));
  }
  return result;
}

/** Decline (Cooper) or expire (sweep): void the authorization, relist the item, email the buyer. Idempotent. */
export async function declineOrder(deps: ApprovalDeps, orderId: string, opts: { kind?: "declined" | "hold_expired"; reason?: string } = {}): Promise<ApprovalResult> {
  if (!deps.stripe) return "stripe_unavailable";
  const kind = opts.kind ?? "declined";
  const claimed = await claim(deps.db, orderId, DECLINING);
  if (!claimed) return settledResult(deps.db, orderId, ["declined", "hold_expired"]);
  let refund: { id: string; amount: number; status: string } | null = null;
  if (claimed.paymentIntentId) {
    const action = declineAction(await intentState(deps.stripe, claimed.paymentIntentId));
    if (action === "wait") {
      await unclaim(deps.db, orderId, DECLINING);
      return "payment_processing";
    }
    if (action === "refund") refund = await refundIntent(deps.stripe, claimed.paymentIntentId, orderId);
    const ok = action === "none" || (action === "refund" ? Boolean(refund) : await voidIntent(deps.stripe, claimed.paymentIntentId, orderId));
    if (!ok) {
      await unclaim(deps.db, orderId, DECLINING);
      return "stripe_error";
    }
  }
  const now = nowOf(deps);
  const result = await deps.db.transaction(async (tx): Promise<ApprovalResult> => {
    const order = await lockOrder(tx, orderId);
    if (!order || order.status !== DECLINING) return "duplicate";
    await releaseHeld(tx, orderId);
    await tx.update(orders).set({ status: kind, decidedAt: now, decisionReason: opts.reason?.slice(0, 500) || null, updatedAt: now }).where(eq(orders.id, orderId));
    if (refund) {
      const pays = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.orderId, orderId), eq(payments.paymentStatus, "succeeded")));
      for (const p of pays) {
        const [dup] = await tx.select({ id: refunds.id }).from(refunds).where(eq(refunds.providerRefundId, refund.id));
        if (!dup) await tx.insert(refunds).values({ paymentId: p.id, amountCents: refund.amount, reason: kind, providerRefundId: refund.id, status: refund.status });
        await tx.update(payments).set({ paymentStatus: "refunded", updatedAt: now }).where(eq(payments.id, p.id));
        break; // one Stripe payment per order
      }
    }
    await tx.update(payments).set({ paymentStatus: "canceled", updatedAt: now }).where(and(eq(payments.orderId, orderId), eq(payments.paymentStatus, "authorized")));
    return "updated";
  });
  if (result === "updated") {
    const s = await orderSummary(deps.db, orderId);
    if (s?.customerEmail) await sendSafe(deps.mailer, mailCustomerDeclined(s, kind));
    const owner = ownerEmail(deps.env ?? process.env);
    if (s && owner && kind === "hold_expired") await sendSafe(deps.mailer, mailOwnerExpired(owner, s));
  }
  return result;
}

/** Scheduled: reminders at 24h and day 5, auto-cancel at 6 days. Safe to run often and from several processes. */
export async function sweepApprovalHolds(deps: ApprovalDeps) {
  const env = deps.env ?? process.env;
  const now = nowOf(deps);
  const open = await deps.db.select().from(orders).where(eq(orders.status, AWAITING)).limit(200);
  const out = { expired: 0, reminded24h: 0, remindedDay5: 0, failed: 0 };
  const owner = ownerEmail(env);
  for (const o of open) {
    const action = holdAction(o, now);
    if (!action) continue;
    if (action === "expire") {
      const r = await declineOrder(deps, o.id, { kind: "hold_expired", reason: "auto-canceled after 6 days" });
      if (r === "updated") out.expired++;
      else if (r !== "duplicate") out.failed++;
      continue;
    }
    // Mark first (atomic), then send: two sweepers can't both send the same reminder.
    const col = action === "remind_day5" ? orders.reminderDay5SentAt : orders.reminder24hSentAt;
    const set = action === "remind_day5" ? { reminderDay5SentAt: now, reminder24hSentAt: o.reminder24hSentAt ?? now } : { reminder24hSentAt: now };
    const marked = await deps.db.update(orders).set(set).where(and(eq(orders.id, o.id), eq(orders.status, AWAITING), sql`${col} is null`)).returning({ id: orders.id });
    if (!marked.length) continue;
    const s = await orderSummary(deps.db, o.id);
    if (s && owner) await sendSafe(deps.mailer, mailOwnerReminder(owner, s, originOf(env), action === "remind_day5" ? "day5" : "24h"));
    if (action === "remind_day5") out.remindedDay5++;
    else out.reminded24h++;
  }
  return out;
}
