/** Homepage holiday / white elephant banner. Dates are sourced; not a delivery guarantee. */

/** Conservative customer order-by date: two days before the USPS Ground Advantage ship-by. */
export const HOLIDAY_ORDER_BY = "Dec 15";

/** Official USPS recommended send-by for Ground Advantage in the contiguous US (Lower 48), 2026. */
export const USPS_GROUND_ADVANTAGE_SHIP_BY = "Thursday, Dec 17, 2026";

export const USPS_HOLIDAY_DATES_URL = "https://www.usps.com/holiday/holiday-shipping-dates.htm";
export const USPS_HOLIDAY_NEWSROOM_URL =
  "https://about.usps.com/newsroom/national-releases/2026/0922-usps-recommends-2026-holiday-mailing-shipping-dates.htm";

export const HOLIDAY_BANNER_KICKER = "Holiday gift transmission";
export const HOLIDAY_BANNER_TITLE = "Gifts from the Closet and Amazon Picks, plus white elephant ideas.";
export const HOLIDAY_BANNER_ORDER_LINE = "Order by Dec 15 for Christmas delivery in the Lower 48.";
export const HOLIDAY_BANNER_NOTE =
  "Based on USPS Ground Advantage's recommended Dec 17, 2026 ship-by for the contiguous United States. That's a recommendation, not a guarantee. Alaska, Hawaii, and U.S. territories need more time.";

export const HOLIDAY_GIFT_LINKS: { href: string; label: string }[] = [
  { href: "/holiday", label: "Holiday gifts" },
  { href: "/gifts/funny-white-elephant-gifts", label: "White elephant" },
  { href: "/gifts", label: "All gift guides" },
  { href: "/gifts/funny-gifts-for-him", label: "For him" },
  { href: "/gifts/funny-gifts-for-her", label: "For her" },
];

export const SIGNUP_NOTE = "Sign up and we'll show your first-order code right here.";

/**
 * Official USPS recommended send-by dates for expected delivery before December 25, 2026,
 * contiguous United States (Lower 48):
 *   USPS Ground Advantage: Thursday, Dec 17, 2026
 *   Priority Mail: Friday, Dec 18, 2026
 * Source (retrieved Nov 18, 2026):
 *   https://www.usps.com/holiday/holiday-shipping-dates.htm
 *   https://about.usps.com/newsroom/national-releases/2026/0922-usps-recommends-2026-holiday-mailing-shipping-dates.htm
 *
 * SpockShop ships USPS labels via Shippo. Checkout charges a weight-table fee (not a
 * named service), and the admin rate picker typically includes Ground Advantage and
 * Priority Mail. This banner uses Ground Advantage's Dec 17 ship-by — the earlier of
 * those two official dates — and a conservative customer order-by two days before
 * (Dec 15), so there is time to pack and drop off. Recommendation, not a guarantee.
 * Alaska, Hawaii, Puerto Rico, and U.S. territories need more time.
 */
export const HOLIDAY_TZ = "America/Chicago";

/** Last moment that still counts as "order by Dec 15" in America/Chicago (CST, UTC-6 in December). */
export const HOLIDAY_ORDER_BY_END = new Date("2026-12-16T05:59:59.999Z");

export const HOLIDAY_CUTOFF_HEADLINE = "Order by Dec 15 for Christmas delivery";
export const HOLIDAY_CUTOFF_NOTE =
  "For the Lower 48, based on USPS Ground Advantage's recommended Dec 17, 2026 ship-by. That's a recommendation, not a guarantee.";

export function isHolidayOrderWindowOpen(now: Date = new Date()): boolean {
  return now.getTime() <= HOLIDAY_ORDER_BY_END.getTime();
}

export type HolidayCountdown = {
  open: boolean;
  days: number;
  hours: number;
  minutes: number;
  label: string;
};

export function holidayCountdown(now: Date = new Date()): HolidayCountdown {
  if (!isHolidayOrderWindowOpen(now)) {
    return { open: false, days: 0, hours: 0, minutes: 0, label: "" };
  }
  const ms = Math.max(0, HOLIDAY_ORDER_BY_END.getTime() - now.getTime());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  let label: string;
  if (days > 1) label = `${days} days left to order`;
  else if (days === 1) label = `1 day, ${hours} hours left to order`;
  else if (hours >= 1) label = `${hours} hour${hours === 1 ? "" : "s"} left to order`;
  else label = `${minutes} minute${minutes === 1 ? "" : "s"} left to order`;
  return { open: true, days, hours, minutes, label };
}
