/**
 * Amazon Associates compliance: prices and star ratings may only be shown via Amazon's API.
 * Everything public renders a PublicPick, which never carries price or rating fields.
 * DB columns (price_note) are kept for admin reference.
 */
export type PublicPick = {
  id: string;
  title: string;
  imageUrl: string | null;
  amazonUrl: string | null;
  asin: string | null;
  category: string | null;
  /** Curator blurb (our own words, no price/rating claims). */
  blurb?: string | null;
};

export function toPublicPick(item: PublicPick & Record<string, unknown>): PublicPick {
  return { id: item.id, title: item.title, imageUrl: item.imageUrl ?? null, amazonUrl: item.amazonUrl ?? null, asin: item.asin ?? null, category: item.category ?? null, blurb: typeof item.blurb === "string" && item.blurb.trim() ? item.blurb : null };
}
