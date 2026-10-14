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

/** General tangible goods. https://docs.stripe.com/tax/tax-codes */
export const DEFAULT_PRODUCT_TAX_CODE = "txcd_99999999";
/** Shipping charges. */
export const DEFAULT_SHIPPING_TAX_CODE = "txcd_92010001";
const TAX_CODE = /^txcd_\d{8}$/;

export type TaxSettings = { enabled: boolean; productTaxCode: string; shippingTaxCode: string };

/**
 * Stripe Tax is OFF unless STRIPE_TAX_ENABLED=true (needs Stripe Tax set up and an AR registration in the dashboard).
 * STRIPE_PRODUCT_TAX_CODE / STRIPE_SHIPPING_TAX_CODE override the codes; invalid values fall back to the defaults.
 */
export function taxSettings(env: Record<string, string | undefined> = process.env): TaxSettings {
  const code = (v: string | undefined, d: string) => (v && TAX_CODE.test(v.trim()) ? v.trim() : d);
  return {
    enabled: env.STRIPE_TAX_ENABLED?.trim().toLowerCase() === "true",
    productTaxCode: code(env.STRIPE_PRODUCT_TAX_CODE, DEFAULT_PRODUCT_TAX_CODE),
    shippingTaxCode: code(env.STRIPE_SHIPPING_TAX_CODE, DEFAULT_SHIPPING_TAX_CODE),
  };
}

export type PricedLine = { productId: string; title: string; sku: string; unitPriceCents: number; quantity: number; image: string | null; requiresApproval?: boolean };

/**
 * Build the Checkout Session request. Every amount comes from the database lines passed in, never from the client.
 * Tax: off by default. With STRIPE_TAX_ENABLED=true, Stripe Tax computes it (prices are tax-exclusive) and
 * needs a customer address: shipping address for "ship", billing address for "pickup".
 */
export function buildSessionParams(input: {
  orderId: string;
  orderNumber: string;
  lines: PricedLine[];
  method: "pickup" | "ship";
  shipping: { amountCents: number; name: string };
  origin: string;
  now?: Date;
  tax?: TaxSettings;
  /** Authorize only (capture_method=manual); Cooper captures or voids it from /admin/orders. Card only. */
  requiresApproval?: boolean;
}): Stripe.Checkout.SessionCreateParams {
  const now = input.now ?? new Date();
  const tax = input.tax?.enabled ? input.tax : null;
  const absolute = (src: string | null) => (src && /^https:\/\//.test(src) ? src : src && input.origin.startsWith("https://") ? new URL(src, input.origin).toString() : null);
  return {
    mode: "payment",
    client_reference_id: input.orderId,
    metadata: { order_id: input.orderId, order_number: input.orderNumber, fulfillment: input.method, ...(input.requiresApproval ? { requires_approval: "true" } : {}) },
    payment_intent_data: {
      metadata: { order_id: input.orderId, order_number: input.orderNumber },
      ...(input.requiresApproval ? { capture_method: "manual" as const } : {}),
    },
    // Manual capture needs a method that supports separate auth/capture; cards do (~7 day window).
    ...(input.requiresApproval ? { allowed_payment_method_types: ["card" as const] } : {}),
    line_items: input.lines.map((l) => {
      const image = absolute(l.image);
      return {
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: l.unitPriceCents,
          ...(tax ? { tax_behavior: "exclusive" as const } : {}),
          product_data: { name: l.title, metadata: { product_id: l.productId, sku: l.sku }, ...(image ? { images: [image] } : {}), ...(tax ? { tax_code: tax.productTaxCode } : {}) },
        },
      };
    }),
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: input.shipping.name,
          fixed_amount: { amount: input.shipping.amountCents, currency: "usd" },
          ...(tax ? { tax_behavior: "exclusive" as const, tax_code: tax.shippingTaxCode } : {}),
        },
      },
    ],
    ...(input.method === "ship" ? { shipping_address_collection: { allowed_countries: ["US"] } } : {}),
    automatic_tax: { enabled: Boolean(tax) },
    ...(tax && input.method === "pickup" ? { billing_address_collection: "required" as const } : {}),
    phone_number_collection: { enabled: false },
    expires_at: Math.floor(now.getTime() / 1000) + SESSION_TTL_MINUTES * 60,
    success_url: `${input.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/checkout/cancel?order=${encodeURIComponent(input.orderNumber)}`,
  };
}
