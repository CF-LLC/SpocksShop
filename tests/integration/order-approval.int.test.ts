/**
 * Order approval against real Postgres with a mocked Stripe client (no Stripe objects are created).
 * Skipped unless INTEGRATION_DATABASE_URL points at a throwaway, migrated + seeded database.
 */
import { randomBytes } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type Stripe from "stripe";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../lib/db/schema";
import { reserveOrder, releaseStalePending } from "../../lib/checkout/create";
import { CheckoutError } from "../../lib/checkout/core";
import { acceptOrder, declineOrder, onApprovalAsyncPayment, onApprovalCheckoutCompleted, sweepApprovalHolds } from "../../lib/approval/service";
import { HOLD_MS, REMINDER_24H_MS, REMINDER_DAY5_MS } from "../../lib/approval/core";
import type { MailMessage, Mailer } from "../../lib/mail";

const url = process.env.INTEGRATION_DATABASE_URL;
const run = url ? describe : describe.skip;

run("order approval against Postgres (Stripe mocked)", () => {
  const client = postgres(url ?? "", { max: 6 });
  const db = drizzle(client, { schema });
  const created: string[] = [];
  const sent: MailMessage[] = [];
  const mailer: Mailer = { name: "test", send: async (m) => (sent.push(m), { ok: true }) };
  const env = { ORDER_NOTIFY_EMAIL: "cooper@example.test", APP_URL: "https://spockshop.test" };
  let piStatus: Record<string, string> = {};
  let refundsByPi: Record<string, { id: string; amount: number; status: string }[]> = {};
  const stripe = {
    paymentIntents: {
      capture: vi.fn(async (id: string) => ((piStatus[id] = "succeeded"), { id, status: "succeeded" })),
      cancel: vi.fn(async (id: string) => ((piStatus[id] = "canceled"), { id, status: "canceled" })),
      retrieve: vi.fn(async (id: string) => ({ id, status: piStatus[id] ?? "requires_capture" })),
    },
    refunds: {
      list: vi.fn(async ({ payment_intent }: { payment_intent: string }) => ({ data: refundsByPi[payment_intent] ?? [] })),
      create: vi.fn(async ({ payment_intent }: { payment_intent: string }) => {
        const r = { id: `re_${payment_intent}`, amount: 2400, status: "succeeded" };
        refundsByPi[payment_intent] = [r];
        return r;
      }),
    },
  } as unknown as Stripe;
  const deps = (now?: Date) => ({ db, stripe, mailer, env, ...(now ? { now: () => now } : {}) });

  async function product(opts: Partial<typeof schema.products.$inferInsert> = {}) {
    const tag = randomBytes(3).toString("hex");
    const [p] = await db.insert(schema.products).values({ sku: `AP-${tag}`, slug: `ap-${tag}`, title: `Approval item ${tag}`, condition: "Good", priceCents: 2400, weightLb: "1", status: "listed", source: "closet", requiresApproval: true, ...opts }).returning();
    await db.insert(schema.inventory).values({ productId: p.id, quantityOnHand: 1 });
    created.push(p.id);
    return p;
  }
  const prod = async (id: string) => (await db.select().from(schema.products).where(eq(schema.products.id, id)))[0];
  const stock = async (id: string) => (await db.select().from(schema.inventory).where(eq(schema.inventory.productId, id)))[0];
  const order = async (id: string) => (await db.select().from(schema.orders).where(eq(schema.orders.id, id)))[0];
  const session = (orderId: string, pi = `pi_${randomBytes(4).toString("hex")}`) =>
    ({ id: `cs_${randomBytes(4).toString("hex")}`, object: "checkout.session", payment_status: "unpaid", payment_intent: pi, amount_total: null, metadata: { order_id: orderId, requires_approval: "true" }, customer_details: { email: "Buyer@Example.test", name: "Buyer" }, collected_information: null }) as unknown as Stripe.Checkout.Session;

  /** Reserve + authorize, as checkout + webhook would. */
  async function held(at = new Date(), piState?: string) {
    const p = await product();
    const r = await reserveOrder(db, { items: [{ productId: p.id, quantity: 1 }], method: "ship" }, {});
    const s = session(r.order.id);
    // As createCheckout does after the session is created.
    await db.insert(schema.payments).values({ orderId: r.order.id, paymentProvider: "stripe", paymentStatus: "pending", providerPaymentId: s.id, amountCents: r.order.totalCents, currency: "USD" });
    if (piState) {
      piStatus[s.payment_intent as string] = piState;
      if (piState === "succeeded") (s as { payment_status: string }).payment_status = "paid";
    }
    expect(await onApprovalCheckoutCompleted(deps(at), r.order.id, s)).toBe("updated");
    return { p, orderId: r.order.id, pi: s.payment_intent as string, s };
  }

  beforeEach(() => { sent.length = 0; piStatus = {}; refundsByPi = {}; vi.clearAllMocks(); });
  afterAll(async () => {
    if (created.length) {
      const items = await db.select({ orderId: schema.orderItems.orderId }).from(schema.orderItems).where(inArray(schema.orderItems.productId, created));
      const ids = [...new Set(items.map((i) => i.orderId))];
      if (ids.length) await db.delete(schema.orders).where(inArray(schema.orders.id, ids));
      await db.delete(schema.products).where(inArray(schema.products.id, created));
    }
    await db.delete(schema.customers).where(eq(schema.customers.email, "buyer@example.test"));
    await client.end();
  });

  it("reserve marks the order as needing approval", async () => {
    const p = await product();
    const r = await reserveOrder(db, { items: [{ productId: p.id, quantity: 1 }], method: "ship" }, {});
    expect(r.order.requiresApproval).toBe(true);
    expect(r.lines[0].requiresApproval).toBe(true);
  });

  it("webhook: holds the item (hidden, pending_approval), creates the order hold, emails Cooper + buyer, once", async () => {
    const { p, orderId, pi, s } = await held();
    const o = await order(orderId);
    expect(o).toMatchObject({ status: "awaiting_approval", paymentIntentId: pi, customerEmail: "buyer@example.test" });
    expect(o.holdExpiresAt!.getTime() - o.authorizedAt!.getTime()).toBe(HOLD_MS);
    expect((await prod(p.id)).status).toBe("pending_approval");
    expect(await stock(p.id)).toMatchObject({ quantityReserved: 1, quantityOnHand: 1 });
    expect(sent.map((m) => [m.to, m.tag])).toEqual([["cooper@example.test", "approval-new"], ["buyer@example.test", "customer-received"]]);
    // Re-delivery: nothing changes, no second email.
    expect(await onApprovalCheckoutCompleted(deps(), orderId, s)).toBe("duplicate");
    expect(sent).toHaveLength(2);
    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("double-purchase guard: a held item can't be checked out again, even concurrently", async () => {
    const { p } = await held();
    await expect(reserveOrder(db, { items: [{ productId: p.id, quantity: 1 }], method: "ship" }, {})).rejects.toBeInstanceOf(CheckoutError);
    const q = await product();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => reserveOrder(db, { items: [{ productId: q.id, quantity: 1 }], method: "ship" }, {})));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await stock(q.id)).quantityReserved).toBe(1);
  });

  it("late webhook after the hold lapsed and someone else bought it: voids the auth, emails the buyer, no double hold", async () => {
    const p = await product();
    const first = await reserveOrder(db, { items: [{ productId: p.id, quantity: 1 }], method: "ship" }, {});
    await db.update(schema.orders).set({ createdAt: new Date(Date.now() - 3 * 3600_000) }).where(eq(schema.orders.id, first.order.id));
    await releaseStalePending(db);
    const second = await reserveOrder(db, { items: [{ productId: p.id, quantity: 1 }], method: "ship" }, {});
    expect(await onApprovalCheckoutCompleted(deps(), second.order.id, session(second.order.id))).toBe("updated");
    sent.length = 0;
    const late = session(first.order.id, "pi_late");
    expect(await onApprovalCheckoutCompleted(deps(), first.order.id, late)).toBe("conflict");
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith("pi_late", {}, { idempotencyKey: `approval-cancel-${first.order.id}` });
    expect((await stock(p.id)).quantityReserved).toBe(1);
    expect(sent.map((m) => m.tag)).toEqual(["customer-conflict"]);
    expect(await onApprovalCheckoutCompleted(deps(), first.order.id, late)).toBe("duplicate");
  });

  it("late webhook after the hold lapsed but item still free: re-takes the hold", async () => {
    const p = await product();
    const r = await reserveOrder(db, { items: [{ productId: p.id, quantity: 1 }], method: "ship" }, {});
    await db.update(schema.orders).set({ createdAt: new Date(Date.now() - 3 * 3600_000) }).where(eq(schema.orders.id, r.order.id));
    await releaseStalePending(db);
    expect(await onApprovalCheckoutCompleted(deps(), r.order.id, session(r.order.id))).toBe("updated");
    expect((await stock(p.id)).quantityReserved).toBe(1);
    expect((await prod(p.id)).status).toBe("pending_approval");
  });

  it("accept: captures, marks sold, emails the buyer; idempotent", async () => {
    const { p, orderId, pi } = await held();
    sent.length = 0;
    expect(await acceptOrder(deps(), orderId)).toBe("updated");
    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith(pi, {}, { idempotencyKey: `approval-capture-${orderId}` });
    expect((await order(orderId)).status).toBe("paid");
    expect((await prod(p.id)).status).toBe("sold");
    expect(await stock(p.id)).toMatchObject({ quantityOnHand: 0, quantityReserved: 0, quantitySold: 1 });
    expect(sent.map((m) => m.tag)).toEqual(["customer-confirmed"]);
    expect(await acceptOrder(deps(), orderId)).toBe("duplicate");
    expect(await declineOrder(deps(), orderId)).toBe("not_awaiting");
    expect(stripe.paymentIntents.capture).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
  });

  it("accept: concurrent double-click captures once and sells once", async () => {
    const { p, orderId } = await held();
    const rs = await Promise.all([acceptOrder(deps(), orderId), acceptOrder(deps(), orderId), acceptOrder(deps(), orderId)]);
    expect(rs.filter((r) => r === "updated")).toHaveLength(1);
    expect((await stock(p.id)).quantitySold).toBe(1);
  });

  it("accept: Stripe failure leaves the order waiting", async () => {
    const { orderId } = await held();
    vi.mocked(stripe.paymentIntents.capture).mockRejectedValueOnce(new Error("card_declined"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await acceptOrder(deps(), orderId)).toBe("stripe_error");
    expect((await order(orderId)).status).toBe("awaiting_approval");
  });

  it("accept/decline without Stripe configured change nothing", async () => {
    const { orderId } = await held();
    expect(await acceptOrder({ ...deps(), stripe: null }, orderId)).toBe("stripe_unavailable");
    expect(await declineOrder({ ...deps(), stripe: null }, orderId)).toBe("stripe_unavailable");
    expect((await order(orderId)).status).toBe("awaiting_approval");
  });

  it("decline: voids, relists the item, emails the buyer; idempotent; item can be bought again", async () => {
    const { p, orderId, pi } = await held();
    sent.length = 0;
    expect(await declineOrder(deps(), orderId, { reason: "sold on Depop" })).toBe("updated");
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith(pi, {}, { idempotencyKey: `approval-cancel-${orderId}` });
    expect(await order(orderId)).toMatchObject({ status: "declined", decisionReason: "sold on Depop" });
    expect((await prod(p.id)).status).toBe("listed");
    expect((await stock(p.id)).quantityReserved).toBe(0);
    expect(sent.map((m) => m.tag)).toEqual(["customer-declined"]);
    expect(await declineOrder(deps(), orderId)).toBe("duplicate");
    expect(await acceptOrder(deps(), orderId)).toBe("not_awaiting");
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledTimes(1);
    await expect(reserveOrder(db, { items: [{ productId: p.id, quantity: 1 }], method: "ship" }, {})).resolves.toBeTruthy();
  });

  it("decline treats an already-canceled PaymentIntent as done", async () => {
    const { orderId, pi } = await held();
    piStatus[pi] = "canceled";
    expect(await declineOrder(deps(), orderId)).toBe("updated");
    // Stripe already says canceled, so there's nothing to void.
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it("accept vs decline race: exactly one wins", async () => {
    const { orderId } = await held();
    const rs = await Promise.all([acceptOrder(deps(), orderId), declineOrder(deps(), orderId)]);
    expect(rs.filter((r) => r === "updated")).toHaveLength(1);
  });

  it("sweep: 24h and day-5 reminders to Cooper once each, then auto-cancel at 6 days", async () => {
    const t0 = new Date(Date.now() - 1000);
    const { p, orderId } = await held(t0);
    const at = (ms: number) => new Date(t0.getTime() + ms);
    const orderNumber = (await order(orderId)).orderNumber;
    const mine = () => sent.filter((m) => m.subject.includes(orderNumber));
    sent.length = 0;
    await sweepApprovalHolds(deps(at(REMINDER_24H_MS - 60_000)));
    expect(mine()).toHaveLength(0);
    await sweepApprovalHolds(deps(at(REMINDER_24H_MS + 60_000)));
    await sweepApprovalHolds(deps(at(REMINDER_24H_MS + 120_000)));
    expect(mine().map((m) => m.tag)).toEqual(["approval-reminder-24h"]);
    await Promise.all([sweepApprovalHolds(deps(at(REMINDER_DAY5_MS + 60_000))), sweepApprovalHolds(deps(at(REMINDER_DAY5_MS + 60_000)))]);
    expect(mine().map((m) => m.tag)).toEqual(["approval-reminder-24h", "approval-reminder-day5"]);
    expect(mine()[1].to).toBe("cooper@example.test");
    await sweepApprovalHolds(deps(at(HOLD_MS + 60_000)));
    expect(await order(orderId)).toMatchObject({ status: "hold_expired" });
    expect((await prod(p.id)).status).toBe("listed");
    expect((await stock(p.id)).quantityReserved).toBe(0);
    expect(mine().map((m) => m.tag)).toEqual(["approval-reminder-24h", "approval-reminder-day5", "customer-hold_expired", "approval-expired"]);
    expect(stripe.paymentIntents.cancel).toHaveBeenCalled();
    await sweepApprovalHolds(deps(at(HOLD_MS + 120_000)));
    expect(mine()).toHaveLength(4);
  });

  const payRow = async (orderId: string) => (await db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)))[0];

  it("immediate-capture method (crypto): held for approval but recorded as charged; owner + buyer told", async () => {
    const { p, orderId } = await held(new Date(), "succeeded");
    expect((await order(orderId)).status).toBe("awaiting_approval");
    expect((await prod(p.id)).status).toBe("pending_approval");
    expect((await payRow(orderId)).paymentStatus).toBe("succeeded");
    expect(sent.find((m) => m.tag === "approval-new")?.text).toMatch(/already charged/);
    expect(sent.find((m) => m.tag === "customer-received")?.text).toMatch(/full refund/);
  });

  it("accept on an already-captured order: no capture call, order paid; idempotent", async () => {
    const { p, orderId } = await held(new Date(), "succeeded");
    expect(await acceptOrder(deps(), orderId)).toBe("updated");
    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
    expect((await order(orderId)).status).toBe("paid");
    expect((await stock(p.id)).quantitySold).toBe(1);
    expect(await acceptOrder(deps(), orderId)).toBe("duplicate");
    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("decline on an already-captured order: full refund, recorded once, no cancel; idempotent", async () => {
    const { p, orderId, pi } = await held(new Date(), "succeeded");
    sent.length = 0;
    expect(await declineOrder(deps(), orderId, { reason: "sold on Depop" })).toBe("updated");
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
    expect(stripe.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ payment_intent: pi }), { idempotencyKey: `approval-refund-${orderId}` });
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(await order(orderId)).toMatchObject({ status: "declined", decisionReason: "sold on Depop" });
    expect((await prod(p.id)).status).toBe("listed");
    const pay = await payRow(orderId);
    expect(pay.paymentStatus).toBe("refunded");
    const rs = await db.select().from(schema.refunds).where(eq(schema.refunds.paymentId, pay.id));
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ providerRefundId: `re_${pi}`, amountCents: 2400, reason: "declined" });
    expect(sent.find((m) => m.tag === "customer-declined")?.subject).toMatch(/refund/);
    expect(await declineOrder(deps(), orderId)).toBe("duplicate");
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
  });

  it("decline retried after a crash mid-refund reuses the existing Stripe refund", async () => {
    const { orderId, pi } = await held(new Date(), "succeeded");
    refundsByPi[pi] = [{ id: "re_existing", amount: 2400, status: "pending" }];
    expect(await declineOrder(deps(), orderId)).toBe("updated");
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("delayed settlement (ACH): accept/decline wait while processing; settles, then accept doesn't capture", async () => {
    const { orderId, pi } = await held(new Date(), "processing");
    expect(await acceptOrder(deps(), orderId)).toBe("payment_processing");
    expect(await declineOrder(deps(), orderId)).toBe("payment_processing");
    expect((await order(orderId)).status).toBe("awaiting_approval");
    piStatus[pi] = "succeeded";
    expect(await onApprovalAsyncPayment(deps(), orderId, "succeeded")).toBe("updated");
    expect(await onApprovalAsyncPayment(deps(), orderId, "succeeded")).toBe("duplicate");
    expect(await acceptOrder(deps(), orderId)).toBe("updated");
    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
    expect((await payRow(orderId)).paymentStatus).toBe("succeeded");
  });

  it("delayed settlement failed: item relisted, order closed, once", async () => {
    const { p, orderId } = await held(new Date(), "processing");
    expect(await onApprovalAsyncPayment(deps(), orderId, "failed")).toBe("updated");
    expect(await order(orderId)).toMatchObject({ status: "declined", decisionReason: "payment_failed" });
    expect((await prod(p.id)).status).toBe("listed");
    expect((await stock(p.id)).quantityReserved).toBe(0);
    expect(await onApprovalAsyncPayment(deps(), orderId, "failed")).toBe("duplicate");
  });
});
