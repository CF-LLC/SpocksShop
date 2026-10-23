import { and, eq, inArray } from "drizzle-orm";
import { addresses, orders, shippingLabels } from "@/lib/db/schema";
import type { Database } from "@/lib/checkout/db";
import { isUniqueViolation } from "@/lib/admin/db-errors";
import { sendSafe, type Mailer } from "@/lib/mail";
import { SHIPPABLE_STATUSES, shipFrom, trackingEmailEnabled, type ShipAddress } from "./config";
import { uspsTrackingUrl, type Parcel, type Rate, type ShippoClient } from "./shippo";

type Env = Record<string, string | undefined>;
export type ShippingDeps = { db: Database; shippo: ShippoClient | null; mailer: Mailer; env?: Env; now?: () => Date };
export type StoredQuote = { shipmentId: string; rates: Rate[]; parcel: Parcel; fetchedAt: string };

export type RatesResult = { ok: true; quote: StoredQuote } | { ok: false; error: string };
export type BuyResult =
  | { ok: true; trackingNumber: string; labelUrl: string; emailed: boolean }
  | { ok: false; error: string; duplicate?: boolean };

export const NOT_CONFIGURED = "Shippo key not configured (SHIPPO_API_KEY). Rates and labels are off until it's set.";

export function parseParcel(input: Record<string, unknown>): Parcel | null {
  const n = (k: string) => Number(String(input[k] ?? "").trim());
  const p = { lengthIn: n("length"), widthIn: n("width"), heightIn: n("height"), weightLb: n("weight") };
  const okDim = (v: number) => Number.isFinite(v) && v > 0 && v <= 108;
  if (![p.lengthIn, p.widthIn, p.heightIn].every(okDim) || !(p.weightLb > 0 && p.weightLb <= 70)) return null;
  return p;
}

async function loadOrder(db: Database, orderId: string) {
  const [row] = await db.select({ o: orders, a: addresses }).from(orders).leftJoin(addresses, eq(addresses.id, orders.shippingAddressId)).where(eq(orders.id, orderId));
  return row;
}

function toAddress(a: typeof addresses.$inferSelect, email: string | null): ShipAddress {
  return { name: a.name ?? "Customer", street1: a.line1, ...(a.line2 ? { street2: a.line2 } : {}), city: a.city, state: a.state, zip: a.postalCode, country: "US", ...(email ? { email } : {}) };
}

/** Fetch USPS rates and remember them on the order. Never buys anything. */
export async function getRates(deps: ShippingDeps, orderId: string, parcel: Parcel): Promise<RatesResult> {
  if (!deps.shippo) return { ok: false, error: NOT_CONFIGURED };
  const from = shipFrom(deps.env);
  if (!from.ok) return { ok: false, error: `Return address not set (${from.missing.join(", ")}). Add it before getting rates.` };
  const row = await loadOrder(deps.db, orderId);
  if (!row) return { ok: false, error: "Order not found." };
  if (!(SHIPPABLE_STATUSES as readonly string[]).includes(row.o.status)) return { ok: false, error: "Only paid orders that haven't shipped can get labels." };
  if (!row.a) return { ok: false, error: "This order has no shipping address on file." };
  const res = await deps.shippo.rates(from.address, toAddress(row.a, row.o.customerEmail), parcel);
  if (!res.rates.length) return { ok: false, error: "Shippo returned no USPS rates for this address/parcel." };
  const quote: StoredQuote = { shipmentId: res.shipmentId, rates: res.rates.sort((a, b) => a.amountCents - b.amountCents), parcel, fetchedAt: (deps.now?.() ?? new Date()).toISOString() };
  await deps.db.update(orders).set({ shippingQuote: quote, updatedAt: new Date() }).where(eq(orders.id, orderId));
  return { ok: true, quote };
}

/**
 * Buy the label for one rate Cooper picked. Only called from the admin "Buy USPS label" form (with confirm).
 * Idempotent: a partial unique index allows one purchasing/purchased label per order, so double clicks can't buy twice.
 */
export async function buyLabel(deps: ShippingDeps, orderId: string, rateId: string, userId: string | null): Promise<BuyResult> {
  if (!deps.shippo) return { ok: false, error: NOT_CONFIGURED };
  const from = shipFrom(deps.env);
  if (!from.ok) return { ok: false, error: `Return address not set (${from.missing.join(", ")}). Label purchase is blocked until it is.` };
  const row = await loadOrder(deps.db, orderId);
  if (!row) return { ok: false, error: "Order not found." };
  if (row.o.status === "shipped") return { ok: false, duplicate: true, error: "Label already bought. Nothing changed." };
  if (!(SHIPPABLE_STATUSES as readonly string[]).includes(row.o.status)) return { ok: false, error: "Only paid orders can get labels." };
  const quote = row.o.shippingQuote as StoredQuote | null;
  const rate = quote?.rates.find((r) => r.id === rateId);
  if (!rate) return { ok: false, error: "That rate is no longer on this order. Get rates again." };

  let labelId: string;
  try {
    const [ins] = await deps.db.insert(shippingLabels).values({ orderId, rateId, status: "purchasing", carrier: rate.carrier, service: rate.service, amountCents: rate.amountCents, createdBy: userId }).returning({ id: shippingLabels.id });
    labelId = ins.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, duplicate: true, error: "A label for this order is already bought or being bought. Nothing changed." };
    throw e;
  }

  let result;
  try {
    result = await deps.shippo.buy(rateId, `label-${orderId}`);
  } catch (e) {
    result = { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
  if (!result.ok) {
    await deps.db.update(shippingLabels).set({ status: "failed", error: result.error.slice(0, 500), updatedAt: new Date() }).where(eq(shippingLabels.id, labelId));
    return { ok: false, error: `Label not bought: ${result.error}` };
  }
  const trackingUrl = result.trackingUrl ?? uspsTrackingUrl(result.trackingNumber);
  const now = deps.now?.() ?? new Date();
  await deps.db.update(shippingLabels).set({ status: "purchased", transactionId: result.transactionId, labelUrl: result.labelUrl, trackingNumber: result.trackingNumber, trackingUrl, updatedAt: now }).where(eq(shippingLabels.id, labelId));
  await deps.db.update(orders).set({ status: "shipped", shippedAt: now, trackingNumber: result.trackingNumber, trackingCarrier: "USPS", trackingUrl, updatedAt: now }).where(and(eq(orders.id, orderId), inArray(orders.status, [...SHIPPABLE_STATUSES])));

  let emailed = false;
  if (trackingEmailEnabled(deps.env) && row.o.customerEmail) {
    emailed = await sendSafe(deps.mailer, trackingEmail({ to: row.o.customerEmail, orderNumber: row.o.orderNumber, trackingNumber: result.trackingNumber, trackingUrl }));
    if (emailed) await deps.db.update(orders).set({ trackingEmailSentAt: now }).where(eq(orders.id, orderId));
  }
  return { ok: true, trackingNumber: result.trackingNumber, labelUrl: result.labelUrl, emailed };
}

/** Buyer tracking email. Sending is OFF unless SHIPPING_TRACKING_EMAIL_ENABLED=true. */
export function trackingEmail(input: { to: string; orderNumber: string; trackingNumber: string; trackingUrl: string }) {
  return {
    to: input.to,
    tag: "order-shipped",
    subject: `Your SpockShop order ${input.orderNumber} has shipped`,
    text: [
      "Good news: your order is on its way.",
      "",
      `Order: ${input.orderNumber}`,
      `Carrier: USPS`,
      `Tracking number: ${input.trackingNumber}`,
      `Track it: ${input.trackingUrl}`,
      "",
      "Tracking can take up to a day to show the first scan. Thanks for shopping with SpockShop!",
    ].join("\n"),
  };
}

export async function labelsFor(db: Database, orderId: string) {
  return db.select().from(shippingLabels).where(eq(shippingLabels.orderId, orderId));
}
