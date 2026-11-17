/** Holiday gift guide: Closet items and Amazon Picks. Prices are never invented or shown for Amazon. */

export const HOLIDAY_PATH = "/holiday";

/** Exclusive upper bounds, in cents: under $10 and under $20. */
export const UNDER_10_CENTS = 1000;
export const UNDER_20_CENTS = 2000;

/**
 * Tasteful note for shoppers coming from Depop or other marketplaces.
 * No specific dollar saving is claimed; there is no direct-price discount in the catalog.
 * Mentions Depop in words only — shoppers are never sent a Depop URL.
 */
export const BUY_DIRECT_COPY =
  "Found us on Depop? Buy direct on SpockShop to skip marketplace fees. It's often cheaper than marketplaces, and items in the same order ship together.";

export type Priced = { priceCents: number };

/** Split live Closet items into under-$10 and $10–under-$20 groups, cheapest first. */
export function holidayGiftSections<T extends Priced>(products: T[]): { under10: T[]; from10to20: T[]; total: number } {
  const under10 = products.filter((p) => p.priceCents >= 0 && p.priceCents < UNDER_10_CENTS).sort((a, b) => a.priceCents - b.priceCents);
  const from10to20 = products.filter((p) => p.priceCents >= UNDER_10_CENTS && p.priceCents < UNDER_20_CENTS).sort((a, b) => a.priceCents - b.priceCents);
  return { under10, from10to20, total: under10.length + from10to20.length };
}

/** Fields used to place a Closet item or Amazon Pick into gift-guide sections. */
export type GiftClassifiable = {
  title: string;
  description?: string | null;
  blurb?: string | null;
  category?: string | null;
  categoryName?: string | null;
  brand?: string | null;
  /** Closet only. Amazon Picks must omit this; they never go in Under $10 (no public price). */
  priceCents?: number;
};

export type GiftSectionId = "under10" | "whiteElephant" | "forHim" | "forHer";

export const GIFT_GUIDE_SECTIONS: { id: GiftSectionId; title: string; kicker: string }[] = [
  { id: "under10", title: "Under $10", kicker: "One-of-a-kind Closet finds, priced under $10 on SpockShop." },
  { id: "whiteElephant", title: "White elephant", kicker: "Fun, quirky Closet finds and Amazon Picks that make an easy party gift." },
  { id: "forHim", title: "For him", kicker: "Closet and Amazon Picks whose titles point to a men’s or ‘for him’ gift." },
  { id: "forHer", title: "For her", kicker: "Closet and Amazon Picks whose titles point to a women’s or ‘for her’ gift." },
];

const HIM_RE =
  /\b(men(?:['’]?s)?|menswear|for him\b|guys?\b|dad(?:'s)?\b|father(?:'s)?|husband|boyfriend|grandpa|grandfather|brother|uncle)\b/i;
const HER_RE =
  /\b(women(?:['’]?s)?|womenswear|for her\b|lad(?:y|ies)\b|mom(?:'s)?\b|mother(?:'s)?|wife|girlfriend|grandma|grandmother|sister|aunt|dress(?:es)?|blouse|skirt|purse|handbag|bralette|makeup|lipstick|necklace|earrings?)\b/i;
const WHITE_ELEPHANT_RE =
  /\b(white elephant|gag(?: gift)?|novelty|funny|joke|kitsch|funko|plush(?:ie)?|squishmallows?|sticker|enamel pin|keychain|key chain|socks?|mug|coaster|ornament|quirky|party gift|board game|puzzle|lego|lightsaber|tricorder|communicator|phaser|tribble|mini(?:ature)?)\b/i;
/** Amazon necessities (paper towels, toothpaste, etc.) stay off the gift guide unless a gift keyword also matches. */
const AMAZON_GIFT_CATEGORIES = new Set(["spock", "star-trek", "home"]);

function haystack(item: GiftClassifiable): string {
  return [item.title, item.description, item.blurb, item.category, item.categoryName, item.brand]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join("\n");
}

/**
 * Which gift-guide sections an item belongs in. An item may appear in more than one.
 * Amazon Picks (no priceCents) are never placed in Under $10, because public pages must not show or invent Amazon prices.
 */
export function giftGuideSectionIds(item: GiftClassifiable): GiftSectionId[] {
  const text = haystack(item);
  const ids: GiftSectionId[] = [];
  const isCloset = typeof item.priceCents === "number";
  const amazonCategory = (item.category ?? "").trim().toLowerCase();
  const amazonEligible = !isCloset && (AMAZON_GIFT_CATEGORIES.has(amazonCategory) || WHITE_ELEPHANT_RE.test(text) || HIM_RE.test(text) || HER_RE.test(text));

  if (isCloset && item.priceCents! >= 0 && item.priceCents! < UNDER_10_CENTS) ids.push("under10");

  const novelty = WHITE_ELEPHANT_RE.test(text);
  const cheapClosetFun = isCloset && item.priceCents! >= 0 && item.priceCents! < UNDER_20_CENTS && novelty;
  const amazonFun = !isCloset && amazonEligible && (novelty || AMAZON_GIFT_CATEGORIES.has(amazonCategory));
  if (cheapClosetFun || amazonFun) ids.push("whiteElephant");

  if (HIM_RE.test(text) && (isCloset || amazonEligible)) ids.push("forHim");
  if (HER_RE.test(text) && (isCloset || amazonEligible)) ids.push("forHer");
  return ids;
}

export function inGiftSection<T extends GiftClassifiable>(items: readonly T[], section: GiftSectionId): T[] {
  const out = items.filter((item) => giftGuideSectionIds(item).includes(section));
  if (section === "under10") {
    return [...out].sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0));
  }
  return out;
}

/** Shopper-facing pages must never include a Depop URL. */
export const DEPOP_URL_RE = /https?:\/\/(?:www\.)?depop\.com\b/i;
