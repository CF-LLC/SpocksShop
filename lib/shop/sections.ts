/** Display names for the three /shop sections. Change names here only. */
export const SHOP_SECTIONS = {
  affiliate: { id: "amazon-picks", title: "Amazon Picks", blurb: "Things we use and recommend, linked to Amazon." },
  closet: { id: "spocks-closet", title: "Spock's Closet", blurb: "One-of-a-kind secondhand finds from Cooper's own closet in Bentonville, AR." },
  community: { id: "community-market", title: "Community Market", blurb: "Approved listings from local sellers." },
} as const;

export const COMMUNITY_MARKET_NAME = SHOP_SECTIONS.community.title;

export const AMAZON_ASSOCIATES_DISCLOSURE = "As an Amazon Associate I earn from qualifying purchases.";

/** rel/target for every outbound affiliate link. */
export const AFFILIATE_LINK_REL = "sponsored nofollow noopener";
export const AFFILIATE_LINK_TARGET = "_blank";
