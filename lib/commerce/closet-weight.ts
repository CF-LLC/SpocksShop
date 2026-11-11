/** Typical shirt weight used when a Closet Pick is saved or imported with no weight. */
export const DEFAULT_CLOSET_WEIGHT_LB = 0.5;

/** Return a positive weight in pounds, or the Closet default when missing/zero. */
export function closetWeightLb(value?: number | string | null): string {
  const n = typeof value === "number" ? value : value == null || value === "" ? NaN : Number(value);
  if (Number.isFinite(n) && n > 0) return String(n);
  return String(DEFAULT_CLOSET_WEIGHT_LB);
}
