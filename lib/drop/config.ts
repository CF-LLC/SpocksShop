type Env = Record<string, string | undefined>;
const on = (v?: string) => ["1", "true", "yes", "on"].includes((v ?? "").trim().toLowerCase());

/** Whole Daily Drop shop. OFF unless DAILY_DROP_ENABLED=true: pages + APIs 404, nothing calls Stripe/Printful. */
export function dropEnabled(env: Env = process.env): boolean {
  return on(env.DAILY_DROP_ENABLED);
}
/** Printful orders are created as drafts. Only PRINTFUL_AUTO_CONFIRM=true confirms them (= Printful charges + prints). */
export function printfulAutoConfirm(env: Env = process.env): boolean {
  return on(env.PRINTFUL_AUTO_CONFIRM);
}

export type Garment = "tee" | "hoodie";
export const PRICES_CENTS: Record<Garment, number> = { tee: 2800, hoodie: 4800 };
export const SHIPPING_CENTS: Record<Garment, number> = { tee: 499, hoodie: 799 };
export const SIZES: Record<Garment, string[]> = {
  tee: ["S", "M", "L", "XL", "2XL"],
  hoodie: ["S", "M", "L", "XL", "2XL"],
};
export const GARMENT_LABEL: Record<Garment, string> = { tee: "Unisex tee", hoodie: "Pullover hoodie" };

export type Design = { slug: string; file: string; title: string; blurb: string; garments: Garment[] };
export const DESIGNS: Design[] = [
  { slug: "screwed-at-work", file: "v4-01-screwed-at-work", title: "I Got Screwed At Work Again", blurb: "A sweaty little screw, a smug screwdriver boss, another Tuesday.", garments: ["tee", "hoodie"] },
  { slug: "nice-melons", file: "v4-02-nice-melons", title: "Nice Melons", blurb: "Two flexing watermelons. Thanks, they grew them themselves.", garments: ["tee", "hoodie"] },
  { slug: "hungover-send-pizza", file: "v4-03-hungover-send-pizza", title: "Hungover As F*ck, Send Pizza", blurb: "A raccoon, a trash can, last night's party hat. Pizza is medicine.", garments: ["tee", "hoodie"] },
  { slug: "ghosted-by-a-ghost", file: "v4-04-ghosted-by-a-ghost", title: "Got Ghosted By A Ghost", blurb: "Table for two, candle lit, chair empty. Even the dead won't text back.", garments: ["tee", "hoodie"] },
  { slug: "nice-pickle", file: "v4-05-nice-pickle", title: "Nice Pickle", blurb: "A ripped, winking pickle. Buy him a drink first.", garments: ["tee", "hoodie"] },
  { slug: "meeting-email", file: "v4-06-meeting-email", title: "This Meeting Could've Been A F*cking Email", blurb: "The coffee mug is on fire and so is its patience.", garments: ["tee", "hoodie"] },
  { slug: "blame-the-tequila", file: "v4-07-blame-the-tequila", title: "Blame The Tequila", blurb: "A lime in a cowboy hat rides the bottle. The salt shaker saw everything.", garments: ["tee", "hoodie"] },
  { slug: "adulting-1-star", file: "v4-08-adulting-1-star", title: "Adulting: 1 Star, Would Not Recommend", blurb: "Bills, laundry, a pan on fire. The possum left a review.", garments: ["tee", "hoodie"] },
  { slug: "love-my-rooster", file: "v4-09-love-my-rooster", title: "I Love My Cock (He's A Rooster, Pervert)", blurb: "A leather-jacket rooster, swooning hens, one judgmental cat.", garments: ["tee", "hoodie"] },
  { slug: "day-drinking", file: "v4-10-day-drinking", title: "Day Drinking Is Just Hydrating With Ambition", blurb: "The sun on a flamingo float, three umbrellas deep, 10 AM.", garments: ["tee", "hoodie"] },
];
/**
 * Held designs: kept (art, print files, rows) but not public or purchasable until Printful accepts a draft.
 * DROP_HELD_SLUGS overrides the default: a comma list of slugs, or "none" to un-hold everything.
 */
export const DEFAULT_HELD_SLUGS = ["nice-melons", "nice-pickle", "love-my-rooster"];
export function heldSlugs(env: Env = process.env): Set<string> {
  const raw = env.DROP_HELD_SLUGS;
  if (raw === undefined || raw.trim() === "") return new Set(DEFAULT_HELD_SLUGS);
  if (raw.trim().toLowerCase() === "none") return new Set();
  return new Set(raw.split(",").map((x) => x.trim()).filter(Boolean));
}
export const isHeld = (slug: string, env: Env = process.env) => heldSlugs(env).has(slug);
export const publicDesigns = (env: Env = process.env) => DESIGNS.filter((d) => !isHeld(d.slug, env));
export const designBySlug = (slug: string) => DESIGNS.find((d) => d.slug === slug) ?? null;

/**
 * Printful catalog variant ids, from PRINTFUL_VARIANTS JSON: {"tee:M": 4012, "hoodie:L": 5531, ...}.
 * Returns null when a size isn't mapped (checkout refuses it rather than guessing).
 */
export function printfulVariant(garment: Garment, size: string, env: Env = process.env): number | null {
  try {
    const map = JSON.parse(env.PRINTFUL_VARIANTS ?? "{}") as Record<string, unknown>;
    const v = Number(map[`${garment}:${size}`]);
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
