import { z } from "zod";
import { isValidAsin, withAffiliateTag } from "../commerce/affiliate";

/**
 * Guide content format (content/guides/<slug>.json). See content/guides/README.md.
 * Strict: unknown keys are rejected, so price/rating fields can never sneak in.
 */
const text = (max: number) => z.string().trim().min(1).max(max);

export const guidePickSchema = z
  .object({
    /** Existing Amazon Pick (affiliate_items.id) */
    itemId: z.string().uuid().optional(),
    /** Existing pick by ASIN, or a new product by ASIN */
    asin: z.string().trim().toUpperCase().refine(isValidAsin, "ASIN must be 10 letters/digits").optional(),
    /** Own Amazon link; tag=mrspock-20 is forced on render */
    url: z.string().url().refine((u) => { try { withAffiliateTag(u); return true; } catch { return false; } }, "url must be an Amazon link").optional(),
    /** Display title; required unless itemId/asin match an existing pick */
    title: text(200).optional(),
    imageUrl: z.string().url().optional(),
    commentary: text(2000),
  })
  .strict()
  .refine((p) => p.itemId || p.asin || p.url, { message: "Each pick needs itemId, asin or url" });

export const guideSectionSchema = z.object({ heading: text(120), intro: text(1500).optional(), picks: z.array(guidePickSchema).max(50) }).strict();

export const guideSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
    title: text(120),
    /** SEO meta description */
    description: z.string().trim().max(200).default(""),
    intro: z.string().trim().max(4000).default(""),
    status: z.enum(["draft", "published"]).default("draft"),
    updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    heroImageUrl: z.string().url().optional(),
    sections: z.array(guideSectionSchema).max(30).default([]),
  })
  .strict();

export type Guide = z.infer<typeof guideSchema>;
export type GuidePick = z.infer<typeof guidePickSchema>;

export function parseGuide(raw: unknown, file = "guide"): Guide {
  const r = guideSchema.safeParse(raw);
  if (!r.success) throw new Error(`${file}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
}

export const isPublished = (g: Guide) => g.status === "published";

/** A pick ready to render: never has price or rating. */
export type ResolvedPick = { key: string; title: string; imageUrl: string | null; link: { amazonUrl: string | null; asin: string | null }; commentary: string };

type Catalog = { id: string; title: string; imageUrl: string | null; amazonUrl: string | null; asin: string | null }[];

/** Match picks to existing Amazon Picks by id/ASIN; fall back to the guide's own url/asin. Unresolvable picks are dropped. */
export function resolvePicks(picks: GuidePick[], catalog: Catalog): ResolvedPick[] {
  const out: ResolvedPick[] = [];
  picks.forEach((p, i) => {
    const hit = (p.itemId && catalog.find((c) => c.id === p.itemId)) || (p.asin && catalog.find((c) => c.asin?.toUpperCase() === p.asin)) || null;
    const title = p.title ?? hit?.title;
    const link = p.url ? { amazonUrl: p.url, asin: null } : hit ? { amazonUrl: hit.amazonUrl, asin: hit.asin } : p.asin ? { amazonUrl: null, asin: p.asin } : null;
    if (!title || !link) return;
    out.push({ key: `${i}-${p.itemId ?? p.asin ?? p.url}`, title, imageUrl: p.imageUrl ?? hit?.imageUrl ?? null, link, commentary: p.commentary });
  });
  return out;
}
