import { describe, expect, it } from "vitest";
import { amazonClickRef } from "@/lib/analytics/events";
import { attributeAffiliateClicks, clickKeyFor, fillClickDays, recentChicagoDays } from "@/lib/affiliate/clicks";
import { chicagoDate } from "@/lib/shop/daily-pick-core";

describe("affiliate click counts", () => {
  const items = [
    { id: "1", asin: "b0abc12345", amazonUrl: "https://www.amazon.com/dp/B0ABC12345?tag=mrspock-20" },
    { id: "2", asin: "B0ZZZZZZZZ", amazonUrl: "https://www.amazon.com/dp/B0YYYYYYYY?tag=mrspock-20" },
    { id: "3", asin: null, amazonUrl: "https://amzn.to/abc?tag=mrspock-20" },
  ];

  it("attributes clicks to the ASIN shoppers actually open", () => {
    expect(clickKeyFor(items[1])).toBe("B0YYYYYYYY");
    const got = attributeAffiliateClicks(items, [
      { ref: "b0abc12345", n: 4, d7: 1, d30: 3 },
      { ref: "B0YYYYYYYY", n: 2, d7: 2, d30: 2 },
      { ref: "link", n: 5, d7: 5, d30: 5 },
    ]);
    expect(got.byId["1"]).toEqual({ n: 4, d7: 1, d30: 3 });
    expect(got.byId["2"]).toEqual({ n: 2, d7: 2, d30: 2 });
    expect(got.byId["3"]).toEqual({ n: 0, d7: 0, d30: 0 });
    expect(got.unattributed).toEqual({ n: 5, d7: 5, d30: 5 });
    expect(got.totals).toEqual({ n: 11, d7: 8, d30: 10 });
  });

  it("fills missing days and does not invent a per-day row", () => {
    expect(fillClickDays(["2026-11-01", "2026-11-02"], [{ day: "2026-11-02", n: 3 }])).toEqual([
      { day: "2026-11-01", n: 0 },
      { day: "2026-11-02", n: 3 },
    ]);
    const days = recentChicagoDays(new Date("2026-11-12T18:00:00Z"), 7);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(chicagoDate(new Date("2026-11-12T18:00:00Z")));
  });

  it("prefers the pick ASIN on short links and otherwise reads the product path", () => {
    expect(amazonClickRef("https://amzn.to/abc", "b0abc12345")).toBe("B0ABC12345");
    expect(amazonClickRef("https://www.amazon.com/dp/B0ABC12345?tag=mrspock-20")).toBe("B0ABC12345");
    expect(amazonClickRef("https://www.amazon.com/dp/b0abc12345", "not-an-asin")).toBe("B0ABC12345");
    expect(amazonClickRef("https://amzn.to/abc")).toBe("link");
    expect(amazonClickRef("not a url")).toBe("link");
  });
});
