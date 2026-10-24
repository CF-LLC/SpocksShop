/**
 * Marketplace against real Postgres (migrated incl. 0017) + stripe-mock. Skipped unless both are set:
 *   INTEGRATION_DATABASE_URL, STRIPE_API_BASE. Test-mode key only.
 */
import { randomBytes } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type Stripe from "stripe";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "../../lib/db/schema";
import { createCheckout } from "../../lib/checkout/create";
import { CheckoutError } from "../../lib/checkout/core";
import { markPaid } from "../../lib/checkout/fulfill";
import { getStripe } from "../../lib/stripe";
import { marketplaceSettings } from "../../lib/marketplace/config";
import { markDelivered, recordSellerPayout } from "../../lib/marketplace/service";

const url = process.env.INTEGRATION_DATABASE_URL;
const base = process.env.STRIPE_API_BASE;
const run = url && base ? describe : describe.skip;
const ON = { COMMUNITY_SELLERS_ENABLED: "true" };

run("marketplace against Postgres + stripe-mock", () => {
  const client = postgres(url ?? "", { max: 4 });
  const db = drizzle(client, { schema });
  const stripe = getStripe({ STRIPE_SECRET_KEY: "sk_test_123", STRIPE_API_BASE: base }) as Stripe;
  const origin = "https://spockshop.test";
  const products: string[] = [];
  const sellerIds: string[] = [];
  const settings = marketplaceSettings(ON);

  async function seller(ready: boolean) {
    const tag = randomBytes(3).toString("hex");
    const [s] = await db.insert(schema.sellers).values({ email: `s-${tag}@example.test`, displayName: `Seller ${tag}`, status: "active", stripeAccountId: ready ? `acct_test_${tag}` : null, transfersActive: ready, connectStatus: ready ? "active" : "not_started" }).returning();
    sellerIds.push(s.id);
    return s;
  }
  async function product(sellerId: string | null) {
    const tag = randomBytes(3).toString("hex");
    const [p] = await db.insert(schema.products).values({ sku: `MK-${tag}`, slug: `mk-${tag}`, title: `MK ${tag}`, condition: "Good", priceCents: 2000, weightLb: "1", status: "listed", source: sellerId ? "community" : "closet", sellerId }).returning();
    await db.insert(schema.inventory).values({ productId: p.id, quantityOnHand: 1 });
    products.push(p.id);
    return p;
  }
  const cart = (...ids: string[]) => ({ items: ids.map((productId) => ({ productId, quantity: 1 })), method: "ship" as const });

  afterAll(async () => {
    const items = products.length ? await db.select({ orderId: schema.orderItems.orderId }).from(schema.orderItems).where(inArray(schema.orderItems.productId, products)) : [];
    const orderIds = [...new Set(items.map((i) => i.orderId))];
    if (orderIds.length) {
      await db.delete(schema.sellerPayouts).where(inArray(schema.sellerPayouts.orderId, orderIds));
      await db.delete(schema.orders).where(inArray(schema.orders.id, orderIds));
    }
    if (products.length) await db.delete(schema.products).where(inArray(schema.products.id, products));
    if (sellerIds.length) await db.delete(schema.sellers).where(inArray(schema.sellers.id, sellerIds));
    await client.end();
  });

  it("blocks seller items when the flag is off or the seller isn't onboarded", async () => {
    const ready = await seller(true);
    const p = await product(ready.id);
    await expect(createCheckout({ db, stripe, origin, env: {} }, cart(p.id))).rejects.toBeInstanceOf(CheckoutError);
    const notReady = await seller(false);
    const q = await product(notReady.id);
    await expect(createCheckout({ db, stripe, origin, env: ON }, cart(q.id))).rejects.toThrow(/isn't open yet/);
  });

  it("rejects mixed carts (two sellers, or seller + shop)", async () => {
    const a = await seller(true), b = await seller(true);
    const pa = await product(a.id), pb = await product(b.id), shop = await product(null);
    await expect(createCheckout({ db, stripe, origin, env: ON }, cart(pa.id, pb.id))).rejects.toThrow(/separate checkouts/);
    await expect(createCheckout({ db, stripe, origin, env: ON }, cart(pa.id, shop.id))).rejects.toThrow(/separate checkouts/);
  });

  it("seller order -> held payout (5%) -> delivered starts the hold window; shop orders untouched", async () => {
    const s = await seller(true);
    const p = await product(s.id);
    const r = await createCheckout({ db, stripe, origin, env: ON }, cart(p.id));
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.orderNumber, r.orderNumber));
    expect(order.sellerId).toBe(s.id);
    const session = { id: r.sessionId, payment_status: "paid", amount_total: order.totalCents, metadata: { order_id: order.id }, customer_details: { email: "buyer@example.test" }, collected_information: null } as unknown as Stripe.Checkout.Session;
    expect(await markPaid(db, order.id, session)).toBe("updated");
    expect(await recordSellerPayout({ db, stripe, settings }, order.id, "pi_test_1")).toBe("recorded");
    expect(await recordSellerPayout({ db, stripe, settings }, order.id, "pi_test_1")).toBe("duplicate");
    const [pay] = await db.select().from(schema.sellerPayouts).where(eq(schema.sellerPayouts.orderId, order.id));
    expect(pay).toMatchObject({ grossCents: 2000, feeCents: 100, amountCents: 1900, status: "held", transferGroup: `order_${order.id}`, releaseAfter: null });
    expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)))[0].platformFeeCents).toBe(100);
    const at = new Date("2026-10-18T15:00:00Z");
    expect(await markDelivered({ db, stripe: null, settings }, order.id, "admin", at)).toBe("started");
    expect(await markDelivered({ db, stripe: null, settings }, order.id, "shippo", new Date())).toBe("unchanged");
    const [after] = await db.select().from(schema.sellerPayouts).where(eq(schema.sellerPayouts.orderId, order.id));
    expect(after.releaseAfter?.toISOString()).toBe("2026-10-21T15:00:00.000Z");
    expect(after.deliveredSource).toBe("admin");

    const shop = await product(null);
    const r2 = await createCheckout({ db, stripe, origin, env: ON }, cart(shop.id));
    const [o2] = await db.select().from(schema.orders).where(eq(schema.orders.orderNumber, r2.orderNumber));
    expect(o2.sellerId).toBeNull();
    expect(await recordSellerPayout({ db, stripe, settings }, o2.id, null)).toBe("not_seller_order");
  });
});
