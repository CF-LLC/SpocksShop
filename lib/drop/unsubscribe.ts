import { createHmac, timingSafeEqual } from "crypto";
import { normalizeEmail } from "./signup";

/** Signed, per-subscriber unsubscribe token (HMAC of the email with SESSION_SECRET). No login needed, can't be guessed. */
export function unsubToken(email: string, secret = process.env.SESSION_SECRET ?? ""): string {
  if (secret.length < 16) throw new Error("SESSION_SECRET must be set to unsubscribe-sign links.");
  return createHmac("sha256", secret).update(`dd-unsub:${email}`).digest("base64url").slice(0, 32);
}

export function verifyUnsub(rawEmail: unknown, token: unknown, secret = process.env.SESSION_SECRET ?? ""): string | null {
  const email = normalizeEmail(rawEmail);
  if (!email || typeof token !== "string" || token.length !== 32 || secret.length < 16) return null;
  const a = Buffer.from(unsubToken(email, secret)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? email : null;
}

export function unsubscribeUrl(email: string, base = "https://spockshop.com", secret?: string): string {
  const e = normalizeEmail(email) ?? email;
  return `${base}/drop/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubToken(e, secret)}`;
}
