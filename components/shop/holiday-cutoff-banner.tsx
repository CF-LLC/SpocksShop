"use client";

import { useEffect, useState } from "react";
import {
  HOLIDAY_CUTOFF_HEADLINE,
  HOLIDAY_CUTOFF_NOTE,
  USPS_HOLIDAY_DATES_URL,
  holidayCountdown,
  isHolidayOrderWindowOpen,
} from "@/lib/shop/holiday-banner";

/** Product-page and cart countdown. Hides after the Dec 15 America/Chicago order-by. */
export function HolidayCutoffBanner({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (now === null || !isHolidayOrderWindowOpen(now)) return null;
  const count = holidayCountdown(now);

  return (
    <div
      data-testid="holiday-cutoff-banner"
      role="status"
      className={compact ? "rounded-xl border border-[var(--line)] bg-[var(--panel,#fff7ed)] px-3 py-2 text-sm" : "panel mb-6 px-4 py-3 sm:px-5"}
    >
      <p className={compact ? "font-semibold" : "font-semibold sm:text-base"}>
        {HOLIDAY_CUTOFF_HEADLINE}
        {count.label ? <span className="muted font-normal"> · {count.label}</span> : null}
      </p>
      {compact ? null : (
        <p className="muted mt-1 text-sm">
          {HOLIDAY_CUTOFF_NOTE}{" "}
          <a href={USPS_HOLIDAY_DATES_URL} className="underline" rel="noopener noreferrer" target="_blank">
            USPS holiday shipping dates
          </a>
          .
        </p>
      )}
    </div>
  );
}
