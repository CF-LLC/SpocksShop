import { randomBytes } from "crypto";
import { z } from "zod";
import type Stripe from "stripe";

export const MAX_LINES = 20;
export const MAX_QTY = 10;
/** Stripe's minimum is 30 minutes; reservations are held for exactly this long. */
export const SESSION_TTL_MINUTES = 30;
/** Pending orders older than this lost their session (webhook missed); their stock is released. */
export const STALE_PENDING_MINUTES = 90;

export const checkoutInputSchema = z.object({
  items: z
    .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(MAX_QTY) }))
    .min(1, "Your cart is empty.")
    .max(MAX_LINES),
  method: z.enum(["pickup", "ship"]),
});
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

/** Merge duplicate lines so a crafted cart can't split one item into many lines. */
export function mergeLines(items: CheckoutInput["items"]): CheckoutInput["items"] {
  const map = new Map<string, number>();
  for (const it of items) map.set(it.productId, (map.get(it.productId) ?? 0) + it.quantity);
  return [...map].map(([productId, quantity]) => ({ productId, quantity })).sort((a, b) => a.productId.localeCompare(b.productId));
}

export class CheckoutError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "CheckoutError";
  }
}

export function newOrderNumber(now = new Date()): string {
  // Shop-local (Chicago) date.
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).replace(/-/g, "");
  return `SPK-${d}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export type PricedLine = { productId: string; title: string; sku: string; unitPriceCents: number; quantity: number; image: string | null };

/**
 * Build the Checkout Session request. Every amount comes from the database lines passed in, never from the client.
 * Tax collection is deliberately off: the only tax row is an unverified placeholder.
 */
export function buildSessionParams(input: {
  orderId: string;
  orderNumber: string;
  lines: PricedLine[];
  method: "pickup" | "ship";
  shipping: { amountCents: number; name: string };
  origin: string;
  now?: Date;
}): Stripe.Checkout.SessionCreateParams {
  const now = input.now ?? new Date();
  const absolute = (src: string | null) => (src && /^https:\/\//.test(src) ? src : src && input.origin.startsWith("https://") ? new URL(src, input.origin).toString() : null);
  return {
    mode: "payment",
    client_reference_id: input.orderId,
    metadata: { order_id: input.orderId, order_number: input.orderNumber, fulfillment: input.method },
    payment_intent_data: { metadata: { order_id: input.orderId, order_number: input.orderNumber } },
    line_items: input.lines.map((l) => {
      const image = absolute(l.image);
      return {
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: l.unitPriceCents,
          product_data: { name: l.title, metadata: { product_id: l.productId, sku: l.sku }, ...(image ? { images: [image] } : {}) },
        },
      };
    }),
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: input.shipping.name,
          fixed_amount: { amount: input.shipping.amountCents, currency: "usd" },
        },
      },
    ],
    ...(input.method === "ship" ? { shipping_address_collection: { allowed_countries: ["US"] } } : {}),
    automatic_tax: { enabled: false },
    phone_number_collection: { enabled: false },
    expires_at: Math.floor(now.getTime() / 1000) + SESSION_TTL_MINUTES * 60,
    success_url: `${input.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/checkout/cancel?order=${encodeURIComponent(input.orderNumber)}`,
  };
}
