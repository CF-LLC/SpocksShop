import { createHash, randomInt } from "crypto";
import type { Garment } from "./config";

/** Shown next to every signup form and stored with each signup. */
export const CONSENT_TEXT = "By signing up you agree to get occasional Daily Drop emails from Spock's Resale Shop. Unsubscribe any time. We never sell your email.";
export const PROMO_PCT = 10;
export const PROMO_LABEL = "10% first-order code";

/**
 * Which units the 10% code applies to. Never deal-priced units (no stacking with bundle / 2-tee).
 * Margin floor ~28% per single unit after 10% off (PRINTFUL_COSTS + Stripe fees, see tests/drop-signup.test.ts):
 *   tee S-XL ~34%, hoodie S-XL ~29%, mug ~40-41%, hat ~29.5%  -> eligible
 *   tee 2XL ~27%, hoodie 2XL ~25%, stickers ~22-25%            -> excluded (full price)
 */
export function promoEligible(garment: Garment, size: string): boolean {
  if (garment === "sticker") return false;
  if ((garment === "tee" || garment === "hoodie") && size === "2XL") return false;
  return true;
}
export const PROMO_RULE = "10% off tees and hoodies (S–XL), mugs and hats. Not on stickers, 2XL, or items already in a bundle or 2-tee deal. One use.";

export const promoAmount = (cents: number) => Math.round(cents * (100 - PROMO_PCT) / 100);

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return null;
  return /^[^\s@<>"',;]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(e) ? e : null;
}

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHA[randomInt(ALPHA.length)];
  return `DROP10-${s}`;
}
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return /^DROP10-[A-Z0-9]{6}$/.test(c) ? c : null;
}

export const hashIp = (ip: string, salt = "") => createHash("sha256").update(`dd-signup:${salt}:${ip}`).digest("hex").slice(0, 32);

/** In-process sliding window (one container). DB check by ip_hash backs it up across restarts. */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit = 5, windowMs = 10 * 60_000, now = Date.now()): boolean {
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > limit;
}
