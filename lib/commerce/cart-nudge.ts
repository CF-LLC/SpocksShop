import { DEFAULT_CLOSET_WEIGHT_LB } from "@/lib/commerce/closet-weight";
import { formatCents } from "@/lib/commerce/money";
import { quoteShipping, type ShippingRateRow } from "@/lib/commerce/shipping";
import { BUNDLE_PATH, BUNDLE_PRICE_CENTS, isClosetBundleSku } from "@/lib/shop/closet-bundle";

/** Show the nudge when shipping is at least this share of the Closet item total ("close to" or more). */
export const SHIPPING_CLOSE_RATIO = 0.8;

export type NudgeCartLine = {
  source: "closet" | "community";
  priceCents: number;
  quantity: number;
  weightLb: number;
  sku?: string | null;
};

export type CartBundleNudge =
  | { show: false }
  | {
      show: true;
      shippingCents: number;
      subtotalCents: number;
      rateName: string | null;
      weightLb: number;
      shippingVsItems: "exceeds" | "close";
      bundleHref: string;
      bundlePriceCents: number;
      /** How many typical 0.5 lb Closet shirts fit in the current rate band. */
      addMoreCount: number | null;
      headline: string;
      shippingLine: string;
      addMoreLine: string | null;
    };

function roundLb(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * When a cart holds only cheap Closet items and the live weight-table shipping
 * quote is more than or close to the item total, suggest the Closet Bundle Box
 * and/or adding more items that stay in the same shipping band.
 * Returns no nudge if the cart isn't Closet-only, already has the bundle,
 * or shipping can't be quoted from the real rate table.
 */
export function cartBundleNudge(input: {
  lines: NudgeCartLine[];
  rates: ShippingRateRow[];
}): CartBundleNudge {
  const hidden: CartBundleNudge = { show: false };
  if (input.lines.length === 0) return hidden;
  if (input.lines.some((l) => l.source !== "closet")) return hidden;
  if (input.lines.some((l) => l.sku && isClosetBundleSku(l.sku))) return hidden;

  const subtotalCents = input.lines.reduce((s, l) => s + l.priceCents * l.quantity, 0);
  const weightLb = roundLb(input.lines.reduce((s, l) => s + l.weightLb * l.quantity, 0));
  if (!(subtotalCents > 0) || !(weightLb > 0)) return hidden;

  const quote = quoteShipping({ method: "ship", weightLb, rates: input.rates });
  if (!quote.ok) return hidden;
  if (quote.amountCents < subtotalCents * SHIPPING_CLOSE_RATIO) return hidden;

  const vs: "exceeds" | "close" = quote.amountCents >= subtotalCents ? "exceeds" : "close";
  const shippingLine =
    vs === "exceeds"
      ? `Shipping is ${formatCents(quote.amountCents)}, more than your ${formatCents(subtotalCents)} of Closet items.`
      : `Shipping is ${formatCents(quote.amountCents)}, close to your ${formatCents(subtotalCents)} item total.`;

  const matched = input.rates.find((r) => r.id === quote.rateId && r.isActive);
  let addMoreCount: number | null = null;
  if (matched) {
    const max = Number(matched.maxWeightLb);
    const room = roundLb(max - weightLb);
    const n = Math.floor((room + 1e-9) / DEFAULT_CLOSET_WEIGHT_LB);
    if (n > 0) {
      const nextWeight = roundLb(weightLb + n * DEFAULT_CLOSET_WEIGHT_LB);
      const next = quoteShipping({ method: "ship", weightLb: nextWeight, rates: input.rates });
      if (next.ok && next.amountCents === quote.amountCents) addMoreCount = n;
    }
  }

  const addMoreLine =
    addMoreCount && addMoreCount > 0
      ? `Add ${addMoreCount} more Closet ${addMoreCount === 1 ? "item" : "items"} at the usual ${DEFAULT_CLOSET_WEIGHT_LB} lb shirt weight and shipping stays ${formatCents(quote.amountCents)}.`
      : null;

  return {
    show: true,
    shippingCents: quote.amountCents,
    subtotalCents,
    rateName: quote.rateName,
    weightLb,
    shippingVsItems: vs,
    bundleHref: BUNDLE_PATH,
    bundlePriceCents: BUNDLE_PRICE_CENTS,
    addMoreCount,
    headline: "Shipping is high for a small Closet order.",
    shippingLine,
    addMoreLine,
  };
}
