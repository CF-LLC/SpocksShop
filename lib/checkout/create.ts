import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { inventory, orderItems, orders, payments, photos, products, sellers, shippingRates } from "@/lib/db/schema";
import { communitySellersEnabled } from "@/lib/features";
import { mediaUrl } from "@/lib/media";
import { quoteShipping } from "@/lib/commerce/shipping";
import { buildSessionParams, CheckoutError, mergeLines, newOrderNumber, STALE_PENDING_MINUTES, taxSettings, type CheckoutInput, type PricedLine } from "./core";
import type { Database } from "./db";
import { releaseOrder } from "./fulfill";
import { needsApproval } from "@/lib/approval/core";

type Env = Record<string, string | undefined>;

/** Release stock held by pending orders whose Checkout Session can no longer be paid (missed expiry webhook). */
export async function releaseStalePending(database: Database, now = new Date()) {
  const cutoff = new Date(now.getTime() - STALE_PENDING_MINUTES * 60_000);
  const stale = await database
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending"), eq(orders.salesChannel, "website"), lt(orders.createdAt, cutoff)))
    .limit(50);
  for (const o of stale) await releaseOrder(database, o.id, "expired");
  return stale.length;
}

/** Lock stock, price the cart from the database and create a pending order holding a reservation. */
export async function reserveOrder(database: Database, input: CheckoutInput, env: Env = process.env) {
  const lines = mergeLines(input.items);
  const ids = lines.map((l) => l.productId);
  return database.transaction(async (tx) => {
    // Lock in id order so concurrent checkouts can't deadlock.
    const stock = await tx.select().from(inventory).where(inArray(inventory.productId, ids)).orderBy(asc(inventory.productId)).for("update");
    const rows = await tx
      .select({ p: products, sellerStatus: sellers.status })
      .from(products)
      .leftJoin(sellers, eq(sellers.id, products.sellerId))
      .where(inArray(products.id, ids));
    const pics = await tx.select().from(photos).where(inArray(photos.productId, ids)).orderBy(asc(photos.sortOrder));

    const priced: PricedLine[] = [];
    let weight = 0;
    for (const line of lines) {
      const row = rows.find((r) => r.p.id === line.productId);
      const inv = stock.find((s) => s.productId === line.productId);
      if (!row || !inv || row.p.status !== "listed" || row.p.source === "affiliate") throw new CheckoutError("An item in your cart is no longer available.", 409);
      if (row.p.source === "community" && (!communitySellersEnabled(env) || row.sellerStatus !== "active")) {
        throw new CheckoutError(`"${row.p.title}" is a seller-listed Closet Picks item. Checkout for those isn't open yet.`, 409);
      }
      if (inv.quantityOnHand - inv.quantityReserved < line.quantity) throw new CheckoutError(`"${row.p.title}" just sold out or is in someone else's checkout.`, 409);
      if (!(row.p.priceCents > 0)) throw new CheckoutError(`"${row.p.title}" has no price yet.`, 409);
      const pic = pics.find((ph) => ph.productId === row.p.id);
      const stored = Array.isArray(row.p.images) ? (row.p.images as { src?: string }[])[0]?.src ?? null : null;
      priced.push({ productId: row.p.id, title: row.p.title, sku: row.p.sku, unitPriceCents: row.p.priceCents, quantity: line.quantity, image: pic ? mediaUrl(pic.storagePath) : stored, requiresApproval: row.p.requiresApproval });
      weight += (row.p.weightLb ? Number(row.p.weightLb) : 0) * line.quantity;
    }

    const rates = await tx.select().from(shippingRates);
    const quote = quoteShipping({ method: input.method, weightLb: Math.round(weight * 100) / 100, rates });
    if (!quote.ok) {
      throw new CheckoutError("We can't quote shipping for this cart yet. Please contact us and we'll sort it out.", 409);
    }

    const subtotal = priced.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: newOrderNumber(),
        salesChannel: "website",
        status: "pending",
        requiresApproval: needsApproval(priced),
        fulfillmentMethod: input.method,
        subtotalCents: subtotal,
        shippingCents: quote.amountCents,
        taxCents: 0,
        totalCents: subtotal + quote.amountCents,
        taxSnapshot: taxSettings(env).enabled
          ? { collected: true, provider: "stripe_tax", reason: "Computed by Stripe Tax at checkout; final amount recorded when paid." }
          : { collected: false, reason: "Tax collection is off until the Arkansas rate is verified with DFA." },
      })
      .returning();
    await tx.insert(orderItems).values(
      priced.map((l) => ({ orderId: order.id, productId: l.productId, titleSnapshot: l.title, skuSnapshot: l.sku, unitPriceCents: l.unitPriceCents, quantity: l.quantity })),
    );
    for (const l of priced) {
      await tx
        .update(inventory)
        .set({ quantityReserved: sql`${inventory.quantityReserved} + ${l.quantity}`, updatedAt: new Date() })
        .where(eq(inventory.productId, l.productId));
    }
    return { order, lines: priced, shipping: { amountCents: quote.amountCents, name: `Shipping (${quote.rateName})` } };
  });
}

/** Full checkout: reserve, create the Stripe session, record the payment row. Releases the hold if Stripe fails. */
export async function createCheckout(deps: { db: Database; stripe: Stripe; origin: string; env?: Env }, input: CheckoutInput) {
  await releaseStalePending(deps.db).catch((e) => console.error("stale release failed", e));
  const reserved = await reserveOrder(deps.db, input, deps.env);
  const { order } = reserved;
  let session: Stripe.Checkout.Session;
  try {
    session = await deps.stripe.checkout.sessions.create(
      buildSessionParams({ orderId: order.id, orderNumber: order.orderNumber, lines: reserved.lines, method: input.method, shipping: reserved.shipping, origin: deps.origin, tax: taxSettings(deps.env), requiresApproval: order.requiresApproval }),
      { idempotencyKey: `checkout-${order.id}` },
    );
  } catch (error) {
    await releaseOrder(deps.db, order.id, "failed");
    console.error("stripe session create failed", { order: order.orderNumber, type: (error as { type?: string }).type });
    throw new CheckoutError("Payment provider is unavailable. Nothing was charged; please try again.", 502);
  }
  await deps.db.insert(payments).values({
    orderId: order.id,
    paymentProvider: "stripe",
    paymentStatus: "pending",
    providerPaymentId: session.id,
    amountCents: order.totalCents,
    currency: "USD",
  });
  if (!session.url) throw new CheckoutError("Payment provider returned no checkout page.", 502);
  return { url: session.url, orderNumber: order.orderNumber, sessionId: session.id };
}
