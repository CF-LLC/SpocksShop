import { formatCents } from "./money";
import type { ShippingRateRow } from "./shipping";

export type ShippingCopyRate = Pick<ShippingRateRow, "minWeightLb" | "maxWeightLb" | "amountCents" | "isActive">;

const FALLBACK =
  "US shipping is one weight-based fee per order, calculated at checkout. Bundle a few Closet Picks in the same order and you pay that postage once.";

function joinOr(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} or ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, or ${parts[parts.length - 1]}`;
}

function formatWeightNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function rateLabel(rate: ShippingCopyRate): string {
  const amount = formatCents(rate.amountCents);
  const min = Number(rate.minWeightLb);
  const max = Number(rate.maxWeightLb);
  if (min <= 0) return `${amount} up to ${formatWeightNumber(max)} lb`;
  return `${amount} for ${formatWeightNumber(min)}–${formatWeightNumber(max)} lb`;
}

/** Public Closet Picks shipping note. Must stay truthful to quoteShipping: one fee per order from the weight table. */
export function closetShippingCopy(rates: ShippingCopyRate[]): { ratesPhrase: string; text: string } {
  const active = rates.filter((rate) => rate.isActive).sort((a, b) => Number(a.minWeightLb) - Number(b.minWeightLb));
  if (active.length === 0) return { ratesPhrase: "", text: FALLBACK };
  const ratesPhrase = joinOr(active.map(rateLabel));
  return {
    ratesPhrase,
    text: `Shipping is ${ratesPhrase}, one fee per US order based on the combined weight of your cart. Bundle a few Closet Picks in the same order and you pay that postage once — often less than shipping each find on its own.`,
  };
}
