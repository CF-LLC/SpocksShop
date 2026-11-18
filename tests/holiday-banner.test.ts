import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOLIDAY_BANNER_NOTE,
  HOLIDAY_BANNER_ORDER_LINE,
  HOLIDAY_GIFT_LINKS,
  HOLIDAY_ORDER_BY,
  HOLIDAY_ORDER_BY_END,
  HOLIDAY_TZ,
  SIGNUP_NOTE,
  USPS_GROUND_ADVANTAGE_SHIP_BY,
  USPS_HOLIDAY_DATES_URL,
  holidayCountdown,
  isHolidayOrderWindowOpen,
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

describe("holiday cutoff countdown", () => {
  it("treats Dec 15, 2026 11:59 PM CT as still open, and Dec 16 CT as closed", () => {
    expect(HOLIDAY_ORDER_BY_END.toISOString()).toBe("2026-12-16T05:59:59.999Z");
    const endInChicago = new Intl.DateTimeFormat("en-US", {
      timeZone: HOLIDAY_TZ,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      timeZoneName: "short",
    }).format(HOLIDAY_ORDER_BY_END);
    expect(endInChicago).toMatch(/December 15, 2026/);
    expect(isHolidayOrderWindowOpen(new Date("2026-12-16T05:59:59.999Z"))).toBe(true);
    expect(isHolidayOrderWindowOpen(new Date("2026-12-16T06:00:00.000Z"))).toBe(false);
  });

  it("counts down while the window is open and is empty after cutoff", () => {
    const mid = holidayCountdown(new Date("2026-12-10T18:00:00.000Z")); // Dec 10 noon CT
    expect(mid.open).toBe(true);
    expect(mid.days).toBe(5);
    expect(mid.label).toMatch(/5 days left to order/);
    const closed = holidayCountdown(new Date("2026-12-16T06:00:00.000Z"));
    expect(closed.open).toBe(false);
    expect(closed.label).toBe("");
  });
});
