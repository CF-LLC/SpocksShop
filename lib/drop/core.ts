import type Stripe from "stripe";
import { DESIGNS, GARMENT_LABEL, PRICES_CENTS, SHIPPING_CENTS, SIZES, designBySlug, printfulVariant, type Garment } from "./config";

type Env = Record<string, string | undefined>;
export type CartLine = { slug: string; garment: Garment; size: string; qty: number };

export function parseCart(input: unknown): CartLine[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 10) return null;
  const out: CartLine[] = [];
  for (const raw of input) {
    const r = raw as Partial<CartLine>;
    const d = typeof r.slug === "string" ? designBySlug(r.slug) : null;
    const g = r.garment as Garment;
    const qty = Number(r.qty ?? 1);
    if (!d || !d.garments.includes(g) || !SIZES[g]?.includes(String(r.size)) || !Number.isInteger(qty) || qty < 1 || qty > 5) return null;
    out.push({ slug: d.slug, garment: g, size: String(r.size), qty });
  }
  return out;
}

/** Checkout Session params: inline price_data (no Stripe Products/Prices created), Stripe Tax automatic_tax, US shipping. */
/** Stripe's minimum USD charge. Verified-admin test sessions are priced to exactly this (before tax), with free shipping. */
export const STRIPE_MIN_CHARGE_CENTS = 50;

/** Per-unit admin test prices: whole cents, sum over all units == STRIPE_MIN_CHARGE_CENTS (or more, if >50 units). */
export function adminUnitAmounts(lines: CartLine[]): number[] {
  const units = lines.reduce((n, l) => n + l.qty, 0);
  const base = Math.max(1, Math.floor(STRIPE_MIN_CHARGE_CENTS / units));
  let extra = Math.max(0, STRIPE_MIN_CHARGE_CENTS - base * units);
  // Give leftover cents to the first line, spread per unit (round up so the total never drops below the minimum).
  return lines.map((l, i) => {
    if (i !== 0 || extra === 0) return base;
    const bump = Math.ceil(extra / l.qty); extra = 0; return base + bump;
  });
}

export function buildSessionParams(lines: CartLine[], origin: string, env: Env = process.env, opts: { adminTest?: boolean } = {}): Stripe.Checkout.SessionCreateParams {
  const adminTest = opts.adminTest === true;
  const hasHoodie = lines.some((l) => l.garment === "hoodie");
  const ship = adminTest ? 0 : hasHoodie ? SHIPPING_CENTS.hoodie : SHIPPING_CENTS.tee;
  const adminUnits = adminTest ? adminUnitAmounts(lines) : null;
  for (const l of lines) if (!printfulVariant(l.garment, l.size, env)) throw new Error(`unmapped variant ${l.garment}:${l.size}`);
  return {
    mode: "payment",
    line_items: lines.map((l, i) => {
      const d = designBySlug(l.slug)!;
      return {
        quantity: l.qty,
        price_data: {
          currency: "usd",
          unit_amount: adminUnits ? adminUnits[i] : PRICES_CENTS[l.garment],
          tax_behavior: "exclusive",
          product_data: {
            name: `${d.title} — ${GARMENT_LABEL[l.garment]} (${l.size})`,
            tax_code: "txcd_30011000", // clothing
            images: [`${origin}/drop/art/${d.file}.webp`],
            metadata: { drop_slug: l.slug, garment: l.garment, size: l.size },
          },
        },
      };
    }),
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: ["US"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Standard (printed to order, 5–10 business days)",
          fixed_amount: { amount: ship, currency: "usd" },
          tax_behavior: "exclusive",
        },
      },
    ],
    metadata: { kind: "daily_drop", cart: JSON.stringify(lines.map((l) => [l.slug, l.garment, l.size, l.qty])), ...(adminTest ? { admin_test: "true" } : {}) },
    success_url: `${origin}/drop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/drop`,
  };
}

export function cartFromSession(session: Pick<Stripe.Checkout.Session, "metadata">): CartLine[] | null {
  try {
    const raw = JSON.parse(session.metadata?.cart ?? "[]") as [string, Garment, string, number][];
    return parseCart(raw.map(([slug, garment, size, qty]) => ({ slug, garment, size, qty })));
  } catch {
    return null;
  }
}

/** Printful v1 POST /orders body. confirm stays false unless explicitly enabled. */
export function buildPrintfulOrder(session: Stripe.Checkout.Session, lines: CartLine[], artBase: string, env: Env = process.env) {
  const addr = session.collected_information?.shipping_details?.address ?? session.customer_details?.address;
  const name = session.collected_information?.shipping_details?.name ?? session.customer_details?.name ?? "";
  return {
    external_id: session.id.slice(-32),
    shipping: "STANDARD",
    recipient: {
      name,
      address1: addr?.line1 ?? "",
      address2: addr?.line2 ?? undefined,
      city: addr?.city ?? "",
      state_code: addr?.state ?? "",
      country_code: addr?.country ?? "US",
      zip: addr?.postal_code ?? "",
      email: session.customer_details?.email ?? undefined,
    },
    items: lines.map((l) => {
      const d = designBySlug(l.slug)!;
      return {
        variant_id: printfulVariant(l.garment, l.size, env),
        quantity: l.qty,
        name: `${d.title} ${l.garment} ${l.size}`,
        files: [{ type: "front", url: `${artBase}/drop/art/${d.file}.png` }],
      };
    }),
  };
}

export type DropDeps = {
  claim(sessionId: string, email: string | null, items: CartLine[], amount: number | null, adminTest?: boolean): Promise<boolean>;
  setResult(sessionId: string, status: string, printfulOrderId: string | null, error: string | null): Promise<void>;
  createPrintfulOrder(body: unknown, confirm: boolean): Promise<{ id: string }>;
};

/** checkout.session.completed -> one Printful draft order. Idempotent via a unique stripe_session_id claim. */
export async function handleDropEvent(event: Stripe.Event, deps: DropDeps, opts: { artBase: string; autoConfirm: boolean; env?: Env }) {
  if (event.type !== "checkout.session.completed") return "ignored";
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.kind !== "daily_drop") return "ignored";
  if (session.payment_status !== "paid") return "unpaid";
  const lines = cartFromSession(session);
  if (!lines) return "bad_cart";
  const fresh = await deps.claim(session.id, session.customer_details?.email ?? null, lines, session.amount_total ?? null, session.metadata?.admin_test === "true");
  if (!fresh) return "duplicate";
  try {
    const order = await deps.createPrintfulOrder(buildPrintfulOrder(session, lines, opts.artBase, opts.env), opts.autoConfirm);
    await deps.setResult(session.id, opts.autoConfirm ? "printful_confirmed" : "printful_draft", order.id, null);
    return "created";
  } catch (e) {
    await deps.setResult(session.id, "printful_failed", null, String((e as Error)?.message ?? e).slice(0, 500));
    return "printful_failed";
  }
}

export const ALL_DESIGNS = DESIGNS;
