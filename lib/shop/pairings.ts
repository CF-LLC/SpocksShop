/**
 * "Pairs well with" Amazon picks. Hand-curated mappings to ASINs that already exist as active Amazon Picks
 * (affiliate_items); the block renders only the ones still active in the DB, and nothing when there's no good match.
 * Never shown for held Drop designs (those pages 404).
 */
export type Pairing = { heading: string; asins: string[] };

export const DROP_PAIRINGS: Record<string, Pairing> = {
  "blame-the-tequila": { heading: "Pairs well with: bar night", asins: ["B07QMXLS4X", "B0BZVB5PF8", "B07YP2VH4B"] },
  "day-drinking": { heading: "Pairs well with: patio hours", asins: ["B0BKRV8XFK", "B0BZVB5PF8", "B07YP2VH4B"] },
  "hungover-send-pizza": { heading: "Pairs well with: the recovery plan", asins: ["B08M5XTF28", "B0748J34WZ", "B0157T1ZK2"] },
  "meeting-email": { heading: "Pairs well with: surviving the 4 PM sync", asins: ["B07GVCP5W2", "B00B7LUVZK", "B08DKS6KCL"] },
  "screwed-at-work": { heading: "Pairs well with: the work desk", asins: ["B099F558S1", "B09SG2Q23M", "B07BW31JTN"] },
  "adulting-1-star": { heading: "Pairs well with: adulting, but easier", asins: ["B0732NXYNS", "B0BJMNHLXZ", "B00HSC9F2C"] },
  "ghosted-by-a-ghost": { heading: "Pairs well with: a night in for one", asins: ["B0157T1ZK2", "B0BKRV8XFK", "B07PY7GLKV"] },
};

/** Closet items: keyword rules on the listing title, first match wins. No rule -> no block. */
const CLOSET_RULES: { re: RegExp; pairing: Pairing }[] = [
  { re: /\blego\b/, pairing: { heading: "Pairs well with: more bricks from space", asins: ["B0CGY3ZB29", "B0BSRD2CXY", "B0CPYVFKB7"] } },
  { re: /playing cards|\buno\b|card game|\bpoker\b/, pairing: { heading: "Pairs well with: game night", asins: ["B01BSXXBZI"] } },
  { re: /\b(goblet|glass(es|ware)?|mug|cup|tumbler)\b/, pairing: { heading: "Pairs well with: the rest of the cabinet", asins: ["B07QMXLS4X", "B0BKRV8XFK", "B0BBPNPZTC"] } },
  {
    re: /\b(t-?shirt|tee|shirt|sweatshirt|hoodie|jacket|coat|dress|top|blouse|jeans|shorts|leggings|bodysuit|cami|bra|pants|scrubs?|bikini|sweater|skirt|vest|cardigan|romper|jumpsuit|tank|crewneck|fleece)\b/,
    pairing: { heading: "Pairs well with: keeping it looking good", asins: ["B00FXNAAW2", "B0BJMNHLXZ", "B0FDWLX8QP"] },
  },
];

export function closetPairing(title: string): Pairing | null {
  const t = title.toLowerCase().replace(/&amp;/g, "&");
  return CLOSET_RULES.find((r) => r.re.test(t))?.pairing ?? null;
}

export const AFFILIATE_DISCLOSURE = "As an Amazon Associate I earn from qualifying purchases.";
