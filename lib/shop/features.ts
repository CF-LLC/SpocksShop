import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateItems } from "@/lib/db/schema";
import { dropEnabled, PRICES_CENTS, publicDesigns } from "@/lib/drop/config";
import { heroImage, mockupUrl } from "@/lib/drop/mockups";

export type AmazonFeature = { kind: "amazon"; key: string; title: string; line: string; image: string; amazonUrl: string | null; asin: string | null };
export type DropFeature = { kind: "drop"; key: string; slug: string; title: string; line: string; image: string; hoodie: string | null; fromCents: number };
export type Feature = AmazonFeature | DropFeature;

/** Rotate a list by the day so the same cards don't always lead. */
export function rotate<T>(list: T[], date = new Date()): T[] {
  if (!list.length) return list;
  const n = Math.floor(date.getTime() / 86_400_000) % list.length;
  return [...list.slice(n), ...list.slice(0, n)];
}

/** Active Amazon picks with an image (no prices: hidden on the public site for Associates compliance). */
export async function amazonFeatures(limit = 12): Promise<AmazonFeature[]> {
  try {
    const rows = await db.select().from(affiliateItems).where(and(eq(affiliateItems.active, true), isNotNull(affiliateItems.imageUrl))).orderBy(asc(affiliateItems.sortOrder), asc(affiliateItems.createdAt)).limit(60);
    return rotate(rows).slice(0, limit).map((r) => ({
      kind: "amazon", key: `a-${r.id}`, title: r.title, line: r.blurb || r.why || "A hand-picked Amazon find we like.", image: r.imageUrl!, amazonUrl: r.amazonUrl, asin: r.asin,
    }));
  } catch {
    return [];
  }
}

/** Public (never held) Daily Drop designs with a tee mockup as the hero image. */
export function dropFeatures(env: Record<string, string | undefined> = process.env, date = new Date()): DropFeature[] {
  if (!dropEnabled(env)) return [];
  return rotate(publicDesigns(env), date).map((d) => ({
    kind: "drop", key: `d-${d.slug}`, slug: d.slug, title: d.title, line: d.blurb, image: heroImage(d), hoodie: mockupUrl(d, "hoodie"), fromCents: PRICES_CENTS.tee,
  }));
}
