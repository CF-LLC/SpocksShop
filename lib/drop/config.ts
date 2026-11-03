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

export type Garment = "tee" | "hoodie" | "mug" | "sticker" | "hat";
export const GARMENTS: Garment[] = ["tee", "hoodie", "mug", "sticker", "hat"];
/** "From" price per product type (smallest option). Use unitPrice() for a specific option. */
export const PRICES_CENTS: Record<Garment, number> = { tee: 2800, hoodie: 4800, mug: 2000, sticker: 700, hat: 2800 };
/** Options that cost more than the type's base price. */
export const OPTION_PRICES_CENTS: Partial<Record<string, number>> = { "mug:15oz": 2400, "sticker:4in": 800, "sticker:5.5in": 900 };
export const unitPrice = (g: Garment, size: string) => OPTION_PRICES_CENTS[`${g}:${size}`] ?? PRICES_CENTS[g];
export const SHIPPING_CENTS: Record<Garment, number> = { tee: 499, hoodie: 799, mug: 799, sticker: 499, hat: 599 };
/** Size (or color for hats, capacity for mugs) options per type. */
export const SIZES: Record<Garment, string[]> = {
  tee: ["S", "M", "L", "XL", "2XL"],
  hoodie: ["S", "M", "L", "XL", "2XL"],
  mug: ["11oz", "15oz"],
  sticker: ["3in", "4in", "5.5in"],
  hat: ["Black", "Navy", "Khaki", "Stone"],
};
export const OPTION_LABEL: Record<Garment, string> = { tee: "Size", hoodie: "Size", mug: "Size", sticker: "Size", hat: "Color" };
export const DEFAULT_OPTION: Record<Garment, string> = { tee: "M", hoodie: "M", mug: "11oz", sticker: "4in", hat: "Black" };
export const GARMENT_LABEL: Record<Garment, string> = { tee: "Unisex tee", hoodie: "Pullover hoodie", mug: "Glossy mug", sticker: "Kiss-cut sticker", hat: "Dad hat" };
/** Stripe tax code per type: apparel (tee/hoodie/hat) = clothing; mugs/stickers = general tangible goods. */
export const TAX_CODE: Record<Garment, string> = { tee: "txcd_30011000", hoodie: "txcd_30011000", hat: "txcd_30011000", mug: "txcd_99999999", sticker: "txcd_99999999" };
/** Printful print-file placement per type (v1 orders API). */
export const PRINT_PLACEMENT: Record<Garment, string> = { tee: "front", hoodie: "front", mug: "default", sticker: "default", hat: "front_dtf_hat" };
/**
 * Built-in Printful catalog variants for the accessory types (catalog products 19 White Glossy Mug, 358 Kiss-Cut Stickers,
 * 206 Yupoong 6245CM dad hat with DTF front print). PRINTFUL_VARIANTS still overrides any key. Tee/hoodie stay env-only.
 */
export const DEFAULT_VARIANTS: Record<string, number> = {
  "mug:11oz": 1320, "mug:15oz": 4830,
  "sticker:3in": 10163, "sticker:4in": 10164, "sticker:5.5in": 10165,
  "hat:Black": 7854, "hat:Navy": 7857, "hat:Khaki": 7855, "hat:Stone": 7859,
};

export type Design = { slug: string; file: string; title: string; blurb: string; garments: Garment[] };
export const DESIGNS: Design[] = [
  { slug: "screwed-at-work", file: "v4-01-screwed-at-work", title: "I Got Screwed At Work Again", blurb: "A sweaty little screw, a smug screwdriver boss, another Tuesday.", garments: GARMENTS },
  { slug: "nice-melons", file: "v4-02-nice-melons", title: "Nice Melons", blurb: "Two flexing watermelons. Thanks, they grew them themselves.", garments: GARMENTS },
  { slug: "hungover-send-pizza", file: "v4-03-hungover-send-pizza", title: "Hungover As F*ck, Send Pizza", blurb: "A raccoon, a trash can, last night's party hat. Pizza is medicine.", garments: GARMENTS },
  { slug: "ghosted-by-a-ghost", file: "v4-04-ghosted-by-a-ghost", title: "Got Ghosted By A Ghost", blurb: "Table for two, candle lit, chair empty. Even the dead won't text back.", garments: GARMENTS },
  { slug: "nice-pickle", file: "v4-05-nice-pickle", title: "Nice Pickle", blurb: "A ripped, winking pickle. Buy him a drink first.", garments: GARMENTS },
  { slug: "meeting-email", file: "v4-06-meeting-email", title: "This Meeting Could've Been A F*cking Email", blurb: "The coffee mug is on fire and so is its patience.", garments: GARMENTS },
  { slug: "blame-the-tequila", file: "v4-07-blame-the-tequila", title: "Blame The Tequila", blurb: "A lime in a cowboy hat rides the bottle. The salt shaker saw everything.", garments: GARMENTS },
  { slug: "adulting-1-star", file: "v4-08-adulting-1-star", title: "Adulting: 1 Star, Would Not Recommend", blurb: "Bills, laundry, a pan on fire. The possum left a review.", garments: GARMENTS },
  { slug: "love-my-rooster", file: "v4-09-love-my-rooster", title: "I Love My Cock (He's A Rooster, Pervert)", blurb: "A leather-jacket rooster, swooning hens, one judgmental cat.", garments: GARMENTS },
  { slug: "day-drinking", file: "v4-10-day-drinking", title: "Day Drinking Is Just Hydrating With Ambition", blurb: "The sun on a flamingo float, three umbrellas deep, 10 AM.", garments: GARMENTS },
  // v5 (2026-11-02): different styles on purpose (type-only label, line art, 70s badge, woodcut, road sign). HELD until Cooper approves the preview.
  { slug: "hot-mess-facts", file: "v5-01-hot-mess-facts", title: "Hot Mess Facts", blurb: "A nutrition label for a disaster: 300% iced coffee, 2% sleep.", garments: GARMENTS },
  { slug: "id-hit-that", file: "v5-02-id-hit-that", title: "I'd Hit That", blurb: "One very cute piñata, drawn in a single line. Confetti pending.", garments: GARMENTS },
  { slug: "pour-decisions", file: "v5-03-pour-decisions", title: "Pour Decisions", blurb: "A 70s sunset and a tipping wine glass. Est. last night.", garments: GARMENTS },
  { slug: "classy-as-trash", file: "v5-04-classy-as-trash", title: "Classy As Trash", blurb: "A monocled raccoon takes tea in a garbage can, pinky up.", garments: GARMENTS },
  { slug: "overshares-after-2-drinks", file: "v5-05-overshares", title: "Caution: Overshares After 2 Drinks", blurb: "An official-looking road sign for that one friend. It's you.", garments: GARMENTS },
];
/**
 * Held designs: kept (art, print files, rows) but not public or purchasable until Cooper approves them.
 * Nice Melons, Nice Pickle and the rooster were released by Cooper on 2026-11-02.
 * DROP_HELD_SLUGS overrides the default: a comma list of slugs, or "none" to un-hold everything.
 */
export const DEFAULT_HELD_SLUGS: string[] = ["hot-mess-facts", "id-hit-that", "pour-decisions", "classy-as-trash", "overshares-after-2-drinks"];
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
    const key = `${garment}:${size}`;
    const v = Number(map[key] ?? DEFAULT_VARIANTS[key]);
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    const v = DEFAULT_VARIANTS[`${garment}:${size}`];
    return v ?? null;
  }
}

/**
 * Design of the day for the homepage: rotates by UTC calendar day among PUBLIC designs only,
 * so a held design can never be picked. Returns null when nothing is public.
 */
export function designOfTheDay(date: Date = new Date(), env: Env = process.env): Design | null {
  const list = publicDesigns(env);
  if (list.length === 0) return null;
  const day = Math.floor(date.getTime() / 86_400_000);
  return list[((day % list.length) + list.length) % list.length];
}
