import Link from "next/link";
import {
  HOLIDAY_BANNER_KICKER,
  HOLIDAY_BANNER_NOTE,
  HOLIDAY_BANNER_ORDER_LINE,
  HOLIDAY_BANNER_TITLE,
  HOLIDAY_GIFT_LINKS,
  USPS_HOLIDAY_DATES_URL,
} from "@/lib/shop/holiday-banner";

/** Space-themed homepage banner pointing at /holiday and the gift guides. No prices. */
export function HolidayGiftBanner() {
  return (
    <section
      aria-labelledby="holiday-banner-title"
      data-testid="holiday-gift-banner"
      className="panel relative overflow-hidden p-6 sm:p-8"
    >
      <p className="t-eyebrow">{HOLIDAY_BANNER_KICKER}</p>
      <h2 id="holiday-banner-title" className="t-h2 mt-2 max-w-2xl">
        {HOLIDAY_BANNER_TITLE}
      </h2>
      <p className="t-lead mt-3 max-w-2xl">{HOLIDAY_BANNER_ORDER_LINE}</p>
      <p className="muted mt-2 max-w-2xl text-sm">
        {HOLIDAY_BANNER_NOTE}{" "}
        <a href={USPS_HOLIDAY_DATES_URL} className="underline" rel="noopener noreferrer" target="_blank">
          USPS holiday shipping dates
        </a>
        .
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link href="/holiday" className="btn btn-primary">
          Shop holiday gifts
        </Link>
        <nav aria-label="Gift guides" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {HOLIDAY_GIFT_LINKS.filter((l) => l.href !== "/holiday").map((l) => (
            <Link key={l.href} href={l.href} className="muted underline-offset-2 hover:text-[var(--text)] hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="hero-tech mt-6 text-[11px] tracking-[0.2em] text-stone-500 uppercase">🖖 Live long and prosper.</p>
    </section>
  );
}
