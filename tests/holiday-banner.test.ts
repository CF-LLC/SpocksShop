import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOLIDAY_BANNER_NOTE,
  HOLIDAY_BANNER_ORDER_LINE,
  HOLIDAY_GIFT_LINKS,
  HOLIDAY_ORDER_BY,
  SIGNUP_NOTE,
  USPS_GROUND_ADVANTAGE_SHIP_BY,
  USPS_HOLIDAY_DATES_URL,
} from "../lib/shop/holiday-banner";

describe("holiday gift banner copy", () => {
  it("uses a conservative Dec 15 order-by vs the official USPS Ground Advantage Dec 17, 2026 ship-by", () => {
    expect(HOLIDAY_ORDER_BY).toBe("Dec 15");
    expect(HOLIDAY_BANNER_ORDER_LINE).toBe("Order by Dec 15 for Christmas delivery in the Lower 48.");
    expect(USPS_GROUND_ADVANTAGE_SHIP_BY).toBe("Thursday, Dec 17, 2026");
    expect(USPS_HOLIDAY_DATES_URL).toBe("https://www.usps.com/holiday/holiday-shipping-dates.htm");
    expect(HOLIDAY_BANNER_NOTE).toMatch(/recommendation, not a guarantee/i);
    expect(HOLIDAY_GIFT_LINKS.map((l) => l.href)).toContain("/holiday");
    expect(HOLIDAY_GIFT_LINKS.map((l) => l.href)).toContain("/gifts/funny-white-elephant-gifts");
    expect(HOLIDAY_GIFT_LINKS.map((l) => l.href)).toContain("/gifts");
  });

  it("homepage no longer claims a new design today or designs daily", () => {
    const home = readFileSync("app/page.tsx", "utf8");
    const signup = readFileSync("components/drop/signup-form.tsx", "utf8");
    expect(home).not.toMatch(/new design today/i);
    expect(home).not.toMatch(/New designs daily/);
    expect(home).toMatch(/HolidayGiftBanner/);
    expect(home).toMatch(/publicDesigns\(\)\.length/);
    expect(signup).not.toMatch(/New designs daily/);
    expect(signup).toContain("first-order code");
    expect(SIGNUP_NOTE).toBe("Sign up and we'll show your first-order code right here.");
  });
});
