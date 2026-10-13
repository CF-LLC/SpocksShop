/** Display names for the two /shop sections. Change names here only. */
export const SHOP_SECTIONS = {
  affiliate: { id: "amazon-picks", title: "Amazon Picks", blurb: "Things we use and recommend, linked to Amazon." },
  closet: { id: "closet-picks", title: "Closet Picks", blurb: "One-of-a-kind secondhand finds from Spock's Closet in Bentonville, AR." },
} as const;

/**
 * Seller-listed items (source = "community") now live inside Closet Picks.
 * Seller signup stays behind COMMUNITY_SELLERS_ENABLED (default off).
 */
export const COMMUNITY_MARKET_NAME = SHOP_SECTIONS.closet.title;

export const AMAZON_ASSOCIATES_DISCLOSURE = "As an Amazon Associate I earn from qualifying purchases.";

/** rel/target for every outbound affiliate link. */
export const AFFILIATE_LINK_REL = "sponsored nofollow noopener";
export const AFFILIATE_LINK_TARGET = "_blank";
