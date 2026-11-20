import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CLOSET_WEIGHT_LB } from "../lib/commerce/closet-weight";
import { quoteShipping, type ShippingRateRow } from "../lib/commerce/shipping";
import {
  BUNDLE_BANNER_TEXT,
  BUNDLE_HEADLINE,
  BUNDLE_PATH,
  BUNDLE_WHITE_ELEPHANT_LINE,
  BUNDLE_PRICE_CENTS,
  BUNDLE_SIZES,
  BUNDLE_SKU_PREFIX,
  BUNDLE_SLUG,
  BUNDLE_TOP_COUNT,
  BUNDLE_WEIGHT_LB,
  bundleDescription,
  bundleShippingSentence,
  bundleTitle,
  closetBundleSizeFromSlug,
  isClosetBundleSku,
  isClosetBundleSlug,
  parseBundleSize,
  quoteBundleShipping,
} from "../lib/shop/closet-bundle";

const liveRates: ShippingRateRow[] = [
  { id: "a", name: "Up to 1 lb", minWeightLb: "0", maxWeightLb: "1", amountCents: 599, isActive: true },
  { id: "b", name: "1–5 lb", minWeightLb: "1.01", maxWeightLb: "5", amountCents: 999, isActive: true },
  { id: "c", name: "5–20 lb", minWeightLb: "5.01", maxWeightLb: "20", amountCents: 1999, isActive: true },
];

describe("closet bundle box", () => {
  it("prices five tops at $14.99 and weighs 2.5 lb so current Closet shipping is one $9.99 fee", () => {
    expect(BUNDLE_TOP_COUNT).toBe(5);
    expect(BUNDLE_PRICE_CENTS).toBe(1499);
    expect(BUNDLE_WEIGHT_LB).toBe(BUNDLE_TOP_COUNT * DEFAULT_CLOSET_WEIGHT_LB);
    expect(BUNDLE_WEIGHT_LB).toBe(2.5);
    expect(quoteBundleShipping(liveRates)).toMatchObject({ ok: true, amountCents: 999, rateName: "1–5 lb" });
    expect(quoteShipping({ method: "ship", weightLb: BUNDLE_WEIGHT_LB, rates: liveRates })).toMatchObject({ ok: true, amountCents: 999 });
    expect(bundleShippingSentence(liveRates)).toContain("$9.99");
    expect(bundleShippingSentence(liveRates)).toContain("2.5 lb");
  });

  it("offers adult Closet sizes and stable per-size SKUs for existing checkout", () => {
    expect(BUNDLE_SIZES.map((s) => s.size)).toEqual(["XS", "S", "M", "L", "XL", "2XL"]);
    for (const size of BUNDLE_SIZES) {
      expect(size.sku.startsWith(BUNDLE_SKU_PREFIX)).toBe(true);
      expect(isClosetBundleSku(size.sku)).toBe(true);
      expect(isClosetBundleSlug(size.slug)).toBe(true);
      expect(closetBundleSizeFromSlug(size.slug)).toBe(size.size);
      expect(parseBundleSize(size.size.toLowerCase())).toBe(size.size);
      expect(bundleTitle(size.size)).toContain(size.size);
      expect(bundleDescription(size.size)).toContain(`size ${size.size}`);
      expect(bundleDescription(size.size).toLowerCase()).not.toContain("depop");
    }
    expect(isClosetBundleSku("SRS-123")).toBe(false);
    expect(isClosetBundleSlug("sonoma-tee")).toBe(false);
    expect(isClosetBundleSlug(BUNDLE_SLUG)).toBe(true);
    expect(parseBundleSize("nope")).toBeNull();
  });

  it("keeps shopper copy free of Depop links and routes the box to its own page", () => {
    const shop = readFileSync("app/shop/page.tsx", "utf8");
    const home = readFileSync("app/page.tsx", "utf8");
    const holiday = readFileSync("app/holiday/page.tsx", "utf8");
    const banner = readFileSync("components/shop/closet-bundle-banner.tsx", "utf8");
    const page = readFileSync("app/shop/closet-bundle/page.tsx", "utf8");
    const buy = readFileSync("components/shop/closet-bundle-buy-box.tsx", "utf8");
    expect(shop).toContain("ClosetBundleBanner");
    expect(home).toContain("ClosetBundleBanner");
    expect(holiday).toContain("ClosetBundleBanner");
    expect(holiday).toContain("BUNDLE_WHITE_ELEPHANT_LINE");
    expect(holiday).toContain('data-testid="holiday-bundle-white-elephant"');
    expect(BUNDLE_WHITE_ELEPHANT_LINE).toMatch(/white elephant/i);
    expect(BUNDLE_WHITE_ELEPHANT_LINE).toContain("$14.99");
    expect(banner).toContain(BUNDLE_PATH);
    expect(banner).toContain("BUNDLE_BANNER_TEXT");
    expect(banner).toContain("BUNDLE_KICKER");
    expect(page).toContain("BUNDLE_HEADLINE");
    expect(page).toContain("ClosetBundleBuyBox");
    for (const src of [banner, page, buy, home, holiday, BUNDLE_BANNER_TEXT, BUNDLE_HEADLINE, BUNDLE_WHITE_ELEPHANT_LINE]) {
      expect(src.toLowerCase()).not.toContain("depop.com");
      expect(src.toLowerCase()).not.toContain("href=\"https://www.depop");
      expect(src.toLowerCase()).not.toContain("depop");
    }
  });
});
