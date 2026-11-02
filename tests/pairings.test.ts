import { describe, expect, it } from "vitest";
import { DROP_PAIRINGS, closetPairing } from "../lib/shop/pairings";
import { DEFAULT_HELD_SLUGS, DESIGNS } from "../lib/drop/config";
import { affiliateUrlFor, isValidAsin } from "../lib/commerce/affiliate";
import { AFFILIATE_LINK_REL, AFFILIATE_LINK_TARGET } from "../lib/shop/sections";

describe("pairs well with", () => {
  it("no pairings for held designs; only real designs; valid ASINs", () => {
    for (const s of DEFAULT_HELD_SLUGS) expect(DROP_PAIRINGS[s]).toBeUndefined();
    for (const [slug, p] of Object.entries(DROP_PAIRINGS)) {
      expect(DESIGNS.some((d) => d.slug === slug)).toBe(true);
      for (const a of p.asins) expect(isValidAsin(a)).toBe(true);
    }
  });
  it("closet rules match sensibly and skip non-matches", () => {
    expect(closetPairing("Blue crewneck sweatshirt with white graphic")?.asins).toContain("B00FXNAAW2");
    expect(closetPairing("LEGO boombox set #lego")?.asins[0]).toBe("B0CGY3ZB29");
    expect(closetPairing("Barbie Uno card game")?.asins).toEqual(["B01BSXXBZI"]);
    expect(closetPairing("White milk glass grape goblet")?.heading).toMatch(/cabinet/);
    expect(closetPairing("Puma Ferrari red sneakers")).toBeNull();
    expect(closetPairing("Xbox one fallout 76")).toBeNull();
    expect(closetPairing("Abercrombie &amp; Fitch sherpa jacket")).not.toBeNull();
  });
  it("links are tagged mrspock-20, sponsored noopener nofollow, new tab", () => {
    expect(affiliateUrlFor({ asin: "B07QMXLS4X" })).toBe("https://www.amazon.com/dp/B07QMXLS4X?tag=mrspock-20");
    expect(AFFILIATE_LINK_REL.split(" ").sort()).toEqual(["nofollow", "noopener", "sponsored"]);
    expect(AFFILIATE_LINK_TARGET).toBe("_blank");
  });
});
