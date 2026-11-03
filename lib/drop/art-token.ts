import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived signed link to a held design's print PNG, so Printful's mockup generator can fetch it
 * (scripts/drop-mockups.mjs) while the design stays 404 for everyone else. Max lifetime 2 hours.
 */
export const ART_TOKEN_MAX_MS = 2 * 60 * 60 * 1000;
export function artToken(file: string, exp: number, secret = process.env.SESSION_SECRET ?? ""): string {
  return createHmac("sha256", secret).update(`drop-art:${file}:${exp}`).digest("hex").slice(0, 32);
}
export function validArtToken(file: string, exp: string | null, token: string | null, now = Date.now(), secret = process.env.SESSION_SECRET ?? ""): boolean {
  if (!secret || secret.length < 16 || !exp || !token || !file.endsWith(".png")) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < now || e > now + ART_TOKEN_MAX_MS) return false;
  const want = Buffer.from(artToken(file, e, secret));
  const got = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}
