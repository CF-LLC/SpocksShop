import { DEFAULT_CLOSET_WEIGHT_LB } from "@/lib/commerce/closet-weight";
import { quoteShipping, type ShippingRateRow } from "@/lib/commerce/shipping";
import { formatCents } from "@/lib/commerce/money";

/** Five secondhand tops in the shopper's size, sold as one Closet product through existing checkout. */
export const BUNDLE_TOP_COUNT = 5;
export const BUNDLE_PRICE_CENTS = 1499;
/** Five tops at the usual Closet shirt weight (0.5 lb each). */
export const BUNDLE_WEIGHT_LB = Number((BUNDLE_TOP_COUNT * DEFAULT_CLOSET_WEIGHT_LB).toFixed(2));
export const BUNDLE_SKU_PREFIX = "SRS-BUNDLE-TOPS-";
export const BUNDLE_SLUG = "closet-bundle";
export const BUNDLE_PATH = `/shop/${BUNDLE_SLUG}`;
export const BUNDLE_IMAGE = {
  id: "closet-bundle-box",
  src: "/closet-bundle-box.svg",
  alt: "A starry gift crate packed with folded tops, labeled Closet Bundle Box.",
  width: 1200,
  height: 1000,
} as const;

export const BUNDLE_SIZES = [
  { size: "XS", label: "XS", id: "a11c0b0e-b0d5-4111-8111-c105e7b0d001", sku: "SRS-BUNDLE-TOPS-XS", slug: "closet-bundle-box-xs" },
  { size: "S", label: "S", id: "a11c0b0e-b0d5-4111-8111-c105e7b0d002", sku: "SRS-BUNDLE-TOPS-S", slug: "closet-bundle-box-s" },
  { size: "M", label: "M", id: "a11c0b0e-b0d5-4111-8111-c105e7b0d003", sku: "SRS-BUNDLE-TOPS-M", slug: "closet-bundle-box-m" },
  { size: "L", label: "L", id: "a11c0b0e-b0d5-4111-8111-c105e7b0d004", sku: "SRS-BUNDLE-TOPS-L", slug: "closet-bundle-box-l" },
  { size: "XL", label: "XL", id: "a11c0b0e-b0d5-4111-8111-c105e7b0d005", sku: "SRS-BUNDLE-TOPS-XL", slug: "closet-bundle-box-xl" },
  { size: "2XL", label: "2XL", id: "a11c0b0e-b0d5-4111-8111-c105e7b0d006", sku: "SRS-BUNDLE-TOPS-2XL", slug: "closet-bundle-box-2xl" },
] as const;

export type BundleSize = (typeof BUNDLE_SIZES)[number]["size"];

export const BUNDLE_TITLE_BASE = "Closet Bundle Box";
export const BUNDLE_BRAND = "Spock's Closet";
export const BUNDLE_CONDITION = "Good";
export const BUNDLE_CONDITION_NOTES =
  "Condition varies by piece, typically Good or better. I'll note anything notable when I pack the box.";
export const BUNDLE_KICKER = "Closet Picks · Five tops, one shipping fee";
export const BUNDLE_HEADLINE = "Five Closet tops in your size, packed as one box.";
export const BUNDLE_BANNER_TEXT = "Skip five shipping fees. Get five tops in your size, packed as one box, for $14.99 plus one US shipping fee.";
/** Shopper-facing line for the holiday white-elephant section. No marketplace names or links. */
export const BUNDLE_WHITE_ELEPHANT_LINE =
  "Need a ready-to-wrap white elephant gift? A Closet Bundle Box is five tops in one size, packed as one box, for $14.99 plus one US shipping fee.";

export function bundleTitle(size: BundleSize): string {
  return `${BUNDLE_TITLE_BASE} — 5 tops, size ${size}`;
}

export function bundleDescription(size: BundleSize): string {
  return [
    `A box of five secondhand tops in size ${size}, picked from current Closet stock.`,
    "You choose the size; I pick the shirts. Condition varies by piece, typically Good or better.",
    "Because these are one-of-a-kind finds, the exact tops aren't listed in advance.",
    "Price is $14.99 for the box. US shipping is one fee for the box, from the same Closet weight table as other Closet Picks.",
    `The box is packed at ${BUNDLE_WEIGHT_LB} lb (five tops at the usual ${DEFAULT_CLOSET_WEIGHT_LB} lb Closet shirt weight).`,
    "If I don't have five tops in your size when the order comes in, I'll email you to switch sizes or I'll refund you.",
  ].join(" ");
}

export function isClosetBundleSku(sku: string): boolean {
  return sku.startsWith(BUNDLE_SKU_PREFIX);
}

export function isClosetBundleSlug(slug: string): boolean {
  return slug === BUNDLE_SLUG || BUNDLE_SIZES.some((s) => s.slug === slug);
}

export function closetBundleSizeFromSlug(slug: string): BundleSize | null {
  return BUNDLE_SIZES.find((s) => s.slug === slug)?.size ?? null;
}

export function parseBundleSize(value: string | null | undefined): BundleSize | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return BUNDLE_SIZES.find((s) => s.size === normalized)?.size ?? null;
}

/** Shipping quote for one bundle box against the live Closet weight table. */
export function quoteBundleShipping(rates: ShippingRateRow[]) {
  return quoteShipping({ method: "ship", weightLb: BUNDLE_WEIGHT_LB, rates });
}

export function bundleShippingSentence(rates: ShippingRateRow[]): string {
  const quote = quoteBundleShipping(rates);
  if (!quote.ok) {
    return `US shipping is one fee for the box, quoted at checkout from the same Closet weight table as other Closet Picks. The box is packed at ${BUNDLE_WEIGHT_LB} lb.`;
  }
  return `US shipping is one fee for the box: ${formatCents(quote.amountCents)} at today's Closet rates for ${quote.rateName} (the box is packed at ${BUNDLE_WEIGHT_LB} lb). Tax is calculated at checkout.`;
}

export const BUNDLE_SKUS = BUNDLE_SIZES.map((s) => s.sku);
