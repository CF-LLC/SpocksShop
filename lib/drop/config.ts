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
  { slug: "side-quest", file: "dd01-side-quest", title: "Side Quest In Progress", blurb: "Pixel astronaut, treasure planet, zero main-quest progress.", garments: ["tee", "hoodie"] },
  { slug: "overthinker", file: "dd02-overthinker", title: "Professional Overthinker", blurb: "A hard-hat brain on permanent overtime.", garments: ["tee", "hoodie"] },
  { slug: "leaving-early", file: "dd03-leaving-early", title: "My Love Language Is Leaving Early", blurb: "Groovy heart, sprinting for the exit.", garments: ["tee", "hoodie"] },
  { slug: "iced-coffee-spite", file: "dd04-iced-coffee-spite", title: "Running On Iced Coffee & Spite", blurb: "One rocket-powered, very determined cup.", garments: ["tee", "hoodie"] },
  { slug: "meeting-nap", file: "dd05-meeting-nap", title: "This Meeting Could've Been A Nap", blurb: "A cat with better calendar priorities.", garments: ["tee", "hoodie"] },
  { slug: "snack-support", file: "dd06-snack-support", title: "Emotionally Supported By Snacks", blurb: "The snack squad group hug.", garments: ["tee", "hoodie"] },
  { slug: "buffering", file: "dd07-buffering", title: "Do Not Disturb: Currently Buffering", blurb: "Synthwave robot, stuck at 42%.", garments: ["tee", "hoodie"] },
  { slug: "explaining", file: "dd08-explaining", title: "I'm Not Arguing, I'm Explaining Why I'm Right", blurb: "An owl professor with receipts.", garments: ["tee", "hoodie"] },
  { slug: "raccoon-energy", file: "dd09-raccoon-energy", title: "Certified Raccoon Energy", blurb: "Trash-can royalty with pizza.", garments: ["tee", "hoodie"] },
  { slug: "cozy-mode", file: "dd10-cozy-mode", title: "Cozy Mode Activated", blurb: "8-bit cocoa, blanket, battery at 100%.", garments: ["tee", "hoodie"] },
];
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
