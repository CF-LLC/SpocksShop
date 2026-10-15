/** Amazon Picks filter categories. Order = chip order on the Shop page (after "All"). */
export const AFFILIATE_CATEGORIES = [
  { slug: "spock", label: "Space & Sci-Fi", blurb: "Space, astronomy and sci-fi gear" },
  { slug: "necessities", label: "Necessities", blurb: "Household basics: paper towels, cleaners, toothpaste, batteries, chargers" },
  { slug: "home", label: "Home", blurb: "Things for the home: kitchen, decor, storage" },
] as const;

export const AFFILIATE_CATEGORY_SLUGS = ["spock", "necessities", "home"] as const;
export type AffiliateCategory = (typeof AFFILIATE_CATEGORY_SLUGS)[number];

export function parseAffiliateCategory(v: unknown): AffiliateCategory | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (AFFILIATE_CATEGORY_SLUGS as readonly string[]).includes(s) ? (s as AffiliateCategory) : null;
}

/**
 * Batch-file category values → filter slug. The picks batch uses finer-grained
 * categories; every space / sci-fi one rolls up to "spock"
 * (DB key stays "spock"; the chip label is "Space & Sci-Fi").
 */
const CATEGORY_ALIASES: Record<string, AffiliateCategory> = {
  spock: "spock", "star-trek": "spock", startrek: "spock", collectibles: "spock", apparel: "spock", "books-media": "spock", gadgets: "spock", space: "spock", "sci-fi": "spock", scifi: "spock",
  necessities: "necessities", household: "necessities", essentials: "necessities", basics: "necessities",
  home: "home", kitchen: "home", decor: "home", "home-decor": "home", furniture: "home",
};

export function normalizeAffiliateCategory(v: unknown): AffiliateCategory | null | "invalid" {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  return CATEGORY_ALIASES[v.trim().toLowerCase()] ?? "invalid";
}
