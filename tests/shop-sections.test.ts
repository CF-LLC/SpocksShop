import { describe, expect, it } from "vitest";
import { communitySellersEnabled } from "../lib/features";
import { MediaError, resolveMediaPath, validatePhoto } from "../lib/media";
import { AFFILIATE_LINK_REL, AFFILIATE_LINK_TARGET, AMAZON_ASSOCIATES_DISCLOSURE, COMMUNITY_MARKET_NAME, SHOP_SECTIONS } from "../lib/shop/sections";

describe("shop sections", () => {
  it("names the two sections from one config", () => {
    expect(SHOP_SECTIONS.affiliate.title).toBe("Amazon Picks");
    expect(SHOP_SECTIONS.closet.title).toBe("Closet Picks");
    expect(Object.keys(SHOP_SECTIONS)).toEqual(["affiliate", "closet"]);
    expect(COMMUNITY_MARKET_NAME).toBe("Closet Picks");
  });
  it("uses the exact disclosure and link attributes", () => {
    expect(AMAZON_ASSOCIATES_DISCLOSURE).toBe("As an Amazon Associate I earn from qualifying purchases.");
    expect(AFFILIATE_LINK_REL).toBe("sponsored nofollow noopener");
    expect(AFFILIATE_LINK_TARGET).toBe("_blank");
  });
});

describe("COMMUNITY_SELLERS_ENABLED", () => {
  it("defaults off", () => {
    expect(communitySellersEnabled({})).toBe(false);
    expect(communitySellersEnabled({ COMMUNITY_SELLERS_ENABLED: "false" })).toBe(false);
    expect(communitySellersEnabled({ COMMUNITY_SELLERS_ENABLED: "0" })).toBe(false);
  });
  it("turns on with true/1", () => {
    expect(communitySellersEnabled({ COMMUNITY_SELLERS_ENABLED: "true" })).toBe(true);
    expect(communitySellersEnabled({ COMMUNITY_SELLERS_ENABLED: " TRUE " })).toBe(true);
    expect(communitySellersEnabled({ COMMUNITY_SELLERS_ENABLED: "1" })).toBe(true);
  });
});

describe("media", () => {
  it("accepts small images only", () => {
    expect(validatePhoto({ type: "image/png", size: 100 })).toBe("png");
    expect(() => validatePhoto({ type: "image/svg+xml", size: 100 })).toThrow(MediaError);
    expect(() => validatePhoto({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toThrow(MediaError);
  });
  it("refuses path traversal", () => {
    expect(() => resolveMediaPath("../../etc/passwd")).toThrow(MediaError);
    expect(resolveMediaPath("community/a.png").endsWith("community/a.png")).toBe(true);
  });
});
