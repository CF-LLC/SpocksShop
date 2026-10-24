import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type Stripe from "stripe";
import type { Database } from "@/lib/checkout/db";
import { orders, sellerPayouts, sellers } from "@/lib/db/schema";
import type { ShippoClient } from "@/lib/shipping/shippo";
import { connectStatusFrom, decidePayout, payoutSplit, releaseAfter, transferGroupFor, type ChargeFacts } from "./core";
import { marketplaceSettings, type MarketplaceSettings } from "./config";

export type MarketDeps = { db: Database; stripe: Stripe | null; settings?: MarketplaceSettings; now?: () => Date };

export class MarketplaceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const ACCOUNT_INCLUDE: Stripe.V2.Core.AccountRetrieveParams.Include[] = ["configuration.recipient", "requirements"];

function need<T>(v: T | null | undefined, msg: string): T {
  if (v == null) throw new MarketplaceError(msg, 503);
  return v;
}

/**
 * Create (once) the seller's connected account: Accounts v2, Express dashboard, recipient configuration
 * (stripe_transfers only). The platform collects Stripe fees and owns losses (fees_collector/losses_collector=application).
 */
export async function ensureConnectAccount(deps: MarketDeps, sellerId: string): Promise<string> {
  const stripe = need(deps.stripe, "Stripe isn't configured.");
  const [seller] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId));
  if (!seller) throw new MarketplaceError("Seller not found.", 404);
  if (seller.stripeAccountId) return seller.stripeAccountId;
  if (seller.status === "suspended") throw new MarketplaceError("Suspended sellers can't set up payouts.", 403);
  const account = await stripe.v2.core.accounts.create(
    {
      contact_email: seller.email,
      display_name: seller.displayName,
      dashboard: "express",
      identity: { country: "us" },
      defaults: { currency: "usd", responsibilities: { fees_collector: "application", losses_collector: "application" } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      include: ACCOUNT_INCLUDE,
      metadata: { seller_id: seller.id },
    },
    { idempotencyKey: `seller-account-${seller.id}` },
  );
  // Conditional update: a concurrent request can't overwrite an id that already landed.
  const saved = await deps.db
    .update(sellers)
    .set({ stripeAccountId: account.id, ...connectStatusFrom(account as never), connectSyncedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sellers.id, seller.id), isNull(sellers.stripeAccountId)))
    .returning({ id: sellers.stripeAccountId });
  if (saved.length) return account.id;
  const [again] = await deps.db.select({ id: sellers.stripeAccountId }).from(sellers).where(eq(sellers.id, seller.id));
  return need(again?.id, "Could not save the Stripe account.");
}

/** Hosted onboarding link (v2 account links). refresh_url mints a fresh link; return_url re-syncs status. */
export async function onboardingLink(deps: MarketDeps, sellerId: string, origin: string): Promise<string> {
  const stripe = need(deps.stripe, "Stripe isn't configured.");
  const account = await ensureConnectAccount(deps, sellerId);
  const link = await stripe.v2.core.accountLinks.create({
    account,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        collection_options: { fields: "eventually_due" },
        refresh_url: `${origin}/api/sell/connect/onboard`,
        return_url: `${origin}/api/sell/connect/return`,
      },
    },
  });
  return link.url;
}

/** Express dashboard login link for an onboarded seller (payout schedule, bank, 1099 info). */
export async function expressLoginLink(deps: MarketDeps, sellerId: string): Promise<string> {
  const stripe = need(deps.stripe, "Stripe isn't configured.");
  const [seller] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId));
  if (!seller?.stripeAccountId) throw new MarketplaceError("Set up payouts first.", 409);
  const link = await stripe.accounts.createLoginLink(seller.stripeAccountId);
  return link.url;
}

/** Re-fetch the account from Stripe (never trust event payloads) and store its readiness. */
export async function syncConnectAccount(deps: MarketDeps, accountId: string) {
  const stripe = need(deps.stripe, "Stripe isn't configured.");
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ACCOUNT_INCLUDE });
  const status = connectStatusFrom(account as never);
  const updated = await deps.db
    .update(sellers)
    .set({ ...status, connectSyncedAt: (deps.now ?? (() => new Date()))(), updatedAt: new Date() })
    .where(eq(sellers.stripeAccountId, accountId))
    .returning({ id: sellers.id });
  return { matched: updated.length > 0, ...status };
}

/** After an order is paid: if it's a seller order, record the held payout (idempotent per order). */
export async function recordSellerPayout(deps: MarketDeps, orderId: string, paymentIntentId: string | null) {
  const settings = deps.settings ?? marketplaceSettings();
  const [order] = await deps.db.select().from(orders).where(eq(orders.id, orderId));
  if (!order?.sellerId) return "not_seller_order" as const;
  const split = payoutSplit(order.subtotalCents, settings.feeBps, settings.feeMinCents);
  const inserted = await deps.db
    .insert(sellerPayouts)
    .values({
      orderId: order.id,
      sellerId: order.sellerId,
      ...split,
      status: "held",
      holdReason: "awaiting_delivery",
      paymentIntentId: paymentIntentId ?? order.paymentIntentId,
      transferGroup: transferGroupFor(order.id),
    })
    .onConflictDoNothing({ target: sellerPayouts.orderId })
    .returning({ id: sellerPayouts.id });
  if (inserted.length) await deps.db.update(orders).set({ platformFeeCents: split.feeCents, updatedAt: new Date() }).where(eq(orders.id, order.id));
  return inserted.length ? ("recorded" as const) : ("duplicate" as const);
}

/** Delivery from Shippo tracking or an admin click. Starts the release clock; never moves it later. */
export async function markDelivered(deps: MarketDeps, orderId: string, source: "shippo" | "admin", at?: Date) {
  const settings = deps.settings ?? marketplaceSettings();
  const when = at ?? (deps.now ?? (() => new Date()))();
  // Approval (manual-capture) seller orders may reach delivery without the paid hook; record lazily.
  const [o] = await deps.db.select({ sellerId: orders.sellerId, pi: orders.paymentIntentId }).from(orders).where(eq(orders.id, orderId));
  if (o?.sellerId && o.pi) await recordSellerPayout(deps, orderId, o.pi);
  await deps.db.update(orders).set({ deliveredAt: when, updatedAt: new Date() }).where(and(eq(orders.id, orderId), isNull(orders.deliveredAt)));
  const rows = await deps.db
    .update(sellerPayouts)
    .set({ deliveredAt: when, deliveredSource: source, releaseAfter: releaseAfter(when, settings.holdDaysAfterDelivery), holdReason: "delivery_hold_window", updatedAt: new Date() })
    .where(and(eq(sellerPayouts.orderId, orderId), isNull(sellerPayouts.deliveredAt)))
    .returning({ id: sellerPayouts.id });
  return rows.length ? "started" : "unchanged";
}

async function chargeFacts(stripe: Stripe, paymentIntentId: string): Promise<ChargeFacts | null> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  const c = pi.latest_charge;
  if (!c || typeof c === "string") return null;
  return { id: c.id, status: c.status, amount: c.amount, amountRefunded: c.amount_refunded, disputed: c.disputed, paid: c.paid, captured: c.captured };
}

/**
 * Release payouts whose hold window has passed. One Transfer per order, source_transaction = the charge
 * (funds can't be transferred before they settle), transfer_group = order, idempotency key per payout.
 */
export async function sweepPayouts(deps: MarketDeps & { shippo?: ShippoClient | null }) {
  const settings = deps.settings ?? marketplaceSettings();
  const now = (deps.now ?? (() => new Date()))();
  const out = { delivered: 0, transferred: 0, canceled: 0, disputed: 0, flagged: 0, failed: 0 };
  if (!settings.enabled || !deps.stripe) return out;
  const stripe = deps.stripe;

  // 1) Poll tracking for shipped seller orders not yet delivered (fallback when the Shippo webhook isn't set up).
  if (deps.shippo?.track) {
    const shipped = await deps.db
      .select({ id: orders.id, carrier: orders.trackingCarrier, number: orders.trackingNumber, shippedAt: orders.shippedAt })
      .from(orders)
      .innerJoin(sellerPayouts, eq(sellerPayouts.orderId, orders.id))
      .where(and(eq(sellerPayouts.status, "held"), isNull(sellerPayouts.deliveredAt), isNotNull(orders.trackingNumber)))
      .limit(25);
    for (const o of shipped) {
      try {
        const t = await deps.shippo.track(o.carrier || "usps", o.number!);
        if (t.status === "DELIVERED") { await markDelivered(deps, o.id, "shippo", t.deliveredAt ?? now); out.delivered++; }
        else if (o.shippedAt && now.getTime() - o.shippedAt.getTime() > settings.reviewAfterShippedDays * 86_400_000) {
          const f = await deps.db.update(sellerPayouts).set({ needsReview: true, holdReason: "not_delivered_in_time", updatedAt: new Date() })
            .where(and(eq(sellerPayouts.orderId, o.id), eq(sellerPayouts.needsReview, false))).returning({ id: sellerPayouts.id });
          out.flagged += f.length;
        }
      } catch (e) {
        console.warn("payout tracking poll failed", { order: o.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  // 2) Release due payouts.
  const due = await deps.db
    .select({ p: sellerPayouts, s: sellers })
    .from(sellerPayouts)
    .innerJoin(sellers, eq(sellers.id, sellerPayouts.sellerId))
    .where(and(eq(sellerPayouts.status, "held"), lte(sellerPayouts.releaseAfter, now)))
    .limit(25);
  for (const { p, s } of due) {
    try {
      const charge = p.paymentIntentId ? await chargeFacts(stripe, p.paymentIntentId) : null;
      const d = decidePayout(p, charge, s, now);
      if (d.action === "wait") {
        await deps.db.update(sellerPayouts).set({ holdReason: d.reason, updatedAt: new Date() }).where(eq(sellerPayouts.id, p.id));
        continue;
      }
      if (d.action === "cancel") {
        await deps.db.update(sellerPayouts).set({ status: "canceled", holdReason: d.reason, chargeId: charge?.id ?? p.chargeId, updatedAt: new Date() }).where(and(eq(sellerPayouts.id, p.id), eq(sellerPayouts.status, "held")));
        out.canceled++;
        continue;
      }
      if (d.action === "dispute") {
        await deps.db.update(sellerPayouts).set({ status: "disputed", holdReason: d.reason, needsReview: true, updatedAt: new Date() }).where(and(eq(sellerPayouts.id, p.id), eq(sellerPayouts.status, "held")));
        out.disputed++;
        continue;
      }
      const transfer = await stripe.transfers.create(
        {
          amount: d.amountCents,
          currency: p.currency,
          destination: s.stripeAccountId!,
          transfer_group: p.transferGroup,
          source_transaction: charge!.id,
          description: `Seller payout for order ${p.orderId}`,
          metadata: { order_id: p.orderId, seller_id: s.id, payout_id: p.id },
        },
        { idempotencyKey: `seller-payout-${p.id}` },
      );
      await deps.db
        .update(sellerPayouts)
        .set({ status: "transferred", transferId: transfer.id, transferredAt: now, chargeId: charge!.id, holdReason: null, lastError: null, updatedAt: new Date() })
        .where(eq(sellerPayouts.id, p.id));
      out.transferred++;
    } catch (e) {
      out.failed++;
      const msg = e instanceof Error ? e.message.slice(0, 300) : String(e);
      await deps.db.update(sellerPayouts).set({ lastError: msg, updatedAt: new Date() }).where(eq(sellerPayouts.id, p.id));
    }
  }
  return out;
}

/** charge.refunded / charge.dispute.* on the platform account. Before transfer: hold or cancel. After: flag for admin. */
export async function onChargeEvent(deps: MarketDeps, event: Stripe.Event) {
  if (!["charge.refunded", "charge.dispute.created", "charge.dispute.closed", "charge.dispute.funds_withdrawn"].includes(event.type)) return { handled: false as const };
  const obj = event.data.object as { payment_intent?: string | { id: string } | null; status?: string; charge?: string | { id: string } };
  let pi = typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id ?? null;
  if (!pi && event.type.startsWith("charge.dispute") && deps.stripe && obj.charge) {
    const ch = await deps.stripe.charges.retrieve(typeof obj.charge === "string" ? obj.charge : obj.charge.id);
    pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id ?? null;
  }
  if (!pi) return { handled: true as const, result: "no_payment_intent" };
  const [p] = await deps.db.select().from(sellerPayouts).where(eq(sellerPayouts.paymentIntentId, pi));
  if (!p) return { handled: true as const, result: "not_seller_order" };

  if (p.status === "transferred") {
    // Money already moved: the admin decides on a transfer reversal. Never automatic.
    await deps.db.update(sellerPayouts).set({ needsReview: true, holdReason: `${event.type} after transfer: consider a transfer reversal`, updatedAt: new Date() }).where(eq(sellerPayouts.id, p.id));
    return { handled: true as const, result: "flagged_after_transfer" };
  }
  if (event.type === "charge.dispute.created" || event.type === "charge.dispute.funds_withdrawn") {
    await deps.db.update(sellerPayouts).set({ status: "disputed", holdReason: "dispute open", needsReview: true, updatedAt: new Date() }).where(and(eq(sellerPayouts.id, p.id), sql`${sellerPayouts.status} in ('held','disputed')`));
    return { handled: true as const, result: "disputed" };
  }
  if (event.type === "charge.dispute.closed") {
    const won = obj.status === "won" || obj.status === "warning_closed";
    await deps.db.update(sellerPayouts)
      .set(won ? { status: "held", holdReason: "dispute won", updatedAt: new Date() } : { status: "canceled", holdReason: `dispute ${obj.status ?? "closed"}`, updatedAt: new Date() })
      .where(and(eq(sellerPayouts.id, p.id), eq(sellerPayouts.status, "disputed")));
    return { handled: true as const, result: won ? "dispute_won" : "dispute_lost" };
  }
  // charge.refunded: the sweep recomputes the amount from the charge; mark for visibility.
  await deps.db.update(sellerPayouts).set({ holdReason: "refund recorded; amount recomputed at release", updatedAt: new Date() }).where(eq(sellerPayouts.id, p.id));
  return { handled: true as const, result: "refund_noted" };
}

/** Find the seller order for a tracking number (Shippo webhook). */
export async function orderForTracking(db: Database, trackingNumber: string) {
  const [o] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.trackingNumber, trackingNumber), isNotNull(orders.shippedAt)));
  return o?.id ?? null;
}


