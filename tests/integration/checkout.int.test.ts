/**
 * Real Postgres + stripe-mock. Skipped unless both are provided:
 *   INTEGRATION_DATABASE_URL=postgres://...  (a throwaway, migrated database; it is written to)
 *   STRIPE_API_BASE=http://localhost:12111   (stripe-mock)
 */
import { randomBytes } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../lib/db/schema";
import { createCheckout, releaseStalePending } from "../../lib/checkout/create";
import { CheckoutError } from "../../lib/checkout/core";
import { markPaid, releaseOrder } from "../../lib/checkout/fulfill";
import { getStripe } from "../../lib/stripe";

const url = process.env.INTEGRATION_DATABASE_URL;
const base = process.env.STRIPE_API_BASE;
const run = url && base ? describe : describe.skip;

run("checkout against Postgres + stripe-mock", () => {
  const client = postgres(url ?? "", { max: 4 });
  const db = drizzle(client, { schema });
  const stripe = getStripe({ STRIPE_SECRET_KEY: "sk_test_123", STRIPE_API_BASE: base }) as Stripe;
  const created: string[] = [];
  const origin = "https://spockshop.test";

  async function product(opts: Partial<typeof schema.products.$inferInsert> = {}, qty = 1) {
    const tag = randomBytes(3).toString("hex");
    const [p] = await db
      .insert(schema.products)
      .values({ sku: `IT-${tag}`, slug: `it-${tag}`, title: `IT item ${tag}`, condition: "Good", priceCents: 2500, weightLb: "2", status: "listed", source: "closet", ...opts })
      .returning();
    await db.insert(schema.inventory).values({ productId: p.id, quantityOnHand: qty });
    created.push(p.id);
    return p;
  }
  const stock = async (id: string) => (await db.select().from(schema.inventory).where(eq(schema.inventory.productId, id)))[0];
  const orderOf = async (number: string) => (await db.select().from(schema.orders).where(eq(schema.orders.orderNumber, number)))[0];
  const paidSession = (orderId: string, sessionId: string, amount: number) =>
    ({ id: sessionId, object: "checkout.session", payment_status: "paid", amount_total: amount, metadata: { order_id: orderId }, customer_details: { email: "Buyer@Example.test", name: "Test Buyer" }, collected_information: null }) as unknown as Stripe.Checkout.Session;

  beforeAll(async () => {
    await db.select().from(schema.shippingRates).limit(1);
  });
  afterAll(async () => {
    if (created.length) {
      const items = await db.select({ orderId: schema.orderItems.orderId }).from(schema.orderItems).where(inArray(schema.orderItems.productId, created));
      const orderIds = [...new Set(items.map((i) => i.orderId))];
      if (orderIds.length) await db.delete(schema.orders).where(inArray(schema.orders.id, orderIds));
      await db.delete(schema.products).where(inArray(schema.products.id, created));
    }
    await db.delete(schema.customers).where(eq(schema.customers.email, "buyer@example.test"));
    await client.end();
  });

  it("reserves stock, prices from the DB, records the payment, and blocks a second buyer", async () => {
    const p = await product({ priceCents: 4200 });
    const r = await createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" });
    expect(r.url).toBeTruthy();
    expect((await stock(p.id)).quantityReserved).toBe(1);
    const order = await orderOf(r.orderNumber);
    expect(order).toMatchObject({ status: "pending", subtotalCents: 4200, shippingCents: 999, taxCents: 0, totalCents: 5199, fulfillmentMethod: "ship" });
    const [pay] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, order.id));
    expect(pay).toMatchObject({ paymentProvider: "stripe", paymentStatus: "pending", providerPaymentId: r.sessionId, amountCents: 5199 });

    await expect(createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" })).rejects.toBeInstanceOf(CheckoutError);
  });

  it("webhook payment commits the sale exactly once", async () => {
    const p = await product();
    const r = await createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" });
    const order = await orderOf(r.orderNumber);
    expect(order.totalCents).toBe(3499);
    const session = paidSession(order.id, r.sessionId, 3499);
    expect(await markPaid(db, order.id, session)).toBe("updated");
    expect(await markPaid(db, order.id, session)).toBe("duplicate");
    expect(await stock(p.id)).toMatchObject({ quantityOnHand: 0, quantityReserved: 0, quantitySold: 1 });
    expect((await orderOf(r.orderNumber)).status).toBe("paid");
    const [prod] = await db.select().from(schema.products).where(eq(schema.products.id, p.id));
    expect(prod.status).toBe("sold");
    const [pay] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, order.id));
    expect(pay.paymentStatus).toBe("succeeded");
    // A late expiry for the same order changes nothing.
    expect(await releaseOrder(db, order.id, "expired")).toBe("duplicate");
    expect(await stock(p.id)).toMatchObject({ quantityOnHand: 0, quantityReserved: 0, quantitySold: 1 });
  });

  it("expiry releases the hold once, and the item can be bought again", async () => {
    const p = await product({}, 2);
    const r = await createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: p.id, quantity: 2 }], method: "ship" });
    const order = await orderOf(r.orderNumber);
    expect((await stock(p.id)).quantityReserved).toBe(2);
    expect(await releaseOrder(db, order.id, "expired")).toBe("updated");
    expect(await releaseOrder(db, order.id, "expired")).toBe("duplicate");
    expect(await stock(p.id)).toMatchObject({ quantityOnHand: 2, quantityReserved: 0, quantitySold: 0 });
    expect((await orderOf(r.orderNumber)).status).toBe("canceled");
    await createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" });
    expect((await stock(p.id)).quantityReserved).toBe(1);
  });

  it("a paid amount that differs from the order is flagged for review", async () => {
    const p = await product();
    const r = await createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" });
    const order = await orderOf(r.orderNumber);
    expect(await markPaid(db, order.id, paidSession(order.id, r.sessionId, 1))).toBe("needs_review");
    expect((await orderOf(r.orderNumber)).status).toBe("paid_review");
  });

  it("releases the hold when Stripe is unreachable", async () => {
    const p = await product();
    const dead = getStripe({ STRIPE_SECRET_KEY: "sk_test_dead", STRIPE_API_BASE: "http://127.0.0.1:9" }) as Stripe;
    await expect(createCheckout({ db, stripe: dead, origin, env: {} }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" })).rejects.toMatchObject({ status: 502 });
    expect((await stock(p.id)).quantityReserved).toBe(0);
  }, 30_000);

  it("community items are blocked until the seller flag is on; affiliate rows are never sellable", async () => {
    const tag = randomBytes(3).toString("hex");
    const [seller] = await db.insert(schema.sellers).values({ email: `it-${tag}@example.test`, displayName: "IT Seller", status: "active" }).returning();
    const p = await product({ source: "community", sellerId: seller.id });
    await expect(createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" })).rejects.toThrow(/seller-listed Closet Picks item/);
    const r = await createCheckout({ db, stripe, origin, env: { COMMUNITY_SELLERS_ENABLED: "true" } }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" });
    expect(r.orderNumber).toMatch(/^SPK-/);
    const a = await product({ source: "affiliate" });
    await expect(createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: a.id, quantity: 1 }], method: "ship" })).rejects.toBeInstanceOf(CheckoutError);
    await db.delete(schema.products).where(eq(schema.products.id, p.id));
    created.splice(created.indexOf(p.id), 1);
    await db.delete(schema.sellers).where(eq(schema.sellers.id, seller.id));
  });

  it("stale pending orders (missed webhook) release their stock", async () => {
    const p = await product();
    const r = await createCheckout({ db, stripe, origin, env: {} }, { items: [{ productId: p.id, quantity: 1 }], method: "ship" });
    const order = await orderOf(r.orderNumber);
    await db.update(schema.orders).set({ createdAt: new Date(Date.now() - 3 * 3600_000) }).where(eq(schema.orders.id, order.id));
    expect(await releaseStalePending(db)).toBeGreaterThanOrEqual(1);
    expect((await stock(p.id)).quantityReserved).toBe(0);
  });
});
