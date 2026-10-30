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
  { slug: "socks-ufo", file: "v2-01-socks-ufo", title: "So That's Where The Socks Go", blurb: "A tiny alien, a tractor beam, and every sock you ever lost.", garments: ["tee", "hoodie"] },
  { slug: "cant-clap", file: "v2-02-cant-clap", title: "Can't Clap, Still Proud Of You", blurb: "Tiny arms, enormous support.", garments: ["tee", "hoodie"] },
  { slug: "only-gravity", file: "v2-03-only-gravity", title: "No Regrets, Only Gravity", blurb: "Eye contact. Paw on mug. You know how this ends.", garments: ["tee", "hoodie"] },
  { slug: "washed-on-cold", file: "v2-04-washed-on-cold", title: "Should've Washed On Cold", blurb: "One hot cycle later, this ghost has knees.", garments: ["tee", "hoodie"] },
  { slug: "personal-best", file: "v2-05-personal-best", title: "Personal Best: Got Out Of Bed", blurb: "A sloth breaks the finish tape one step from the pillow.", garments: ["tee", "hoodie"] },
  { slug: "act-natural", file: "v2-06-act-natural", title: "Act Natural", blurb: "A pigeon in a trench coat. Definitely not hiding a bagel.", garments: ["tee", "hoodie"] },
  { slug: "pit-day", file: "v2-07-pit-day", title: "Never Skip Pit Day", blurb: "A swole avocado lifts its own pit.", garments: ["tee", "hoodie"] },
  { slug: "slightly-burnt", file: "v2-08-slightly-burnt", title: "Slightly Burnt, Fully Relaxed", blurb: "Toaster hot tub, sunglasses tan line, zero worries.", garments: ["tee", "hoodie"] },
  { slug: "smoke-alarm", file: "v2-09-smoke-alarm", title: "I Cook, The Smoke Alarm Cheers", blurb: "A proud potato chef and a very charred dinner.", garments: ["tee", "hoodie"] },
  { slug: "free-hugs", file: "v2-10-free-hugs", title: "Free Hugs (Terms Apply)", blurb: "The cactus is thrilled. The balloon is not.", garments: ["tee", "hoodie"] },
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
