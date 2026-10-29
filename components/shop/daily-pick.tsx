import Link from "next/link";
import { AffiliateLink } from "@/components/shop/affiliate-link";
import { ExternalIcon } from "@/components/ui/icons";
import { AFFILIATE_CATEGORIES } from "@/lib/affiliate/categories";
import type { DailyPick, DailyPickView } from "@/lib/shop/daily-pick";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";

function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
const catLabel = (c: string | null) => AFFILIATE_CATEGORIES.find((x) => x.slug === c)?.label ?? null;

function Media({ pick, className = "" }: { pick: DailyPick["pick"]; className?: string }) {
  return pick.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pick.imageUrl} alt="" referrerPolicy="no-referrer" className={className} />
  ) : (
    <div className={`grid place-items-center text-5xl ${className}`} aria-hidden>🖖</div>
  );
}

/** The single rotating Amazon pick, with history and (for sellers) tomorrow's pick. */
export function DailyPickSection({ view, compact = false, headingId = "daily-pick-title" }: { view: DailyPickView; compact?: boolean; headingId?: string }) {
  const { today, tomorrow, history } = view;
  return (
    <section aria-labelledby={headingId} id="amazon-picks" className="daily-pick">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="t-eyebrow mb-1">Amazon Pick of the Day</p>
          <h2 id={headingId} className="t-h2">{today ? `Today's pick · ${fmtDate(today.date, { month: "short", day: "numeric" })}` : "Today's pick"}</h2>
        </div>
        {compact && today ? <Link href="/shop?tab=amazon" className="btn btn-outline">Past picks</Link> : null}
      </div>

      {today ? (
        <article className="dp-card" data-testid="daily-pick">
          <div className="dp-glow" aria-hidden />
          <div className="dp-media"><Media pick={today.pick} className="h-full w-full" /></div>
          <div className="dp-body">
            <div className="flex flex-wrap gap-2">
              <span className="chip chip-gold">✦ Pick of the day</span>
              {catLabel(today.pick.category) ? <span className="chip">{catLabel(today.pick.category)}</span> : null}
            </div>
            <h3 className="t-h3 leading-snug">{today.pick.title}</h3>
            <div className="dp-why">
              <p className="dim text-xs font-bold uppercase tracking-wider">Why it&apos;s today&apos;s pick</p>
              <p className="mt-1" data-testid="daily-pick-why">{today.why}</p>
            </div>
            {today.pick.blurb && today.pick.blurb !== today.why ? <p className="dim text-sm">{today.pick.blurb}</p> : null}
            <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
              <AffiliateLink item={today.pick} className="btn btn-primary dp-cta">
                See it on Amazon <ExternalIcon className="h-4 w-4" /><span className="sr-only"> (opens in a new tab)</span>
              </AffiliateLink>
              <span className="dim text-xs">Price and availability on Amazon. A new pick every day at midnight CT.</span>
            </div>
          </div>
        </article>
      ) : (
        <div className="panel flex flex-col items-center px-6 py-12 text-center" data-testid="daily-pick-empty">
          <span aria-hidden className="dp-orbit mb-3 text-4xl">🛰️</span>
          <h3 className="t-h3">Today&apos;s pick is still in orbit</h3>
          <p className="muted mt-2 max-w-md">We&apos;re lining up the next Amazon recommendation. Meanwhile, browse one-of-a-kind finds in the closet.</p>
          <Link href="/shop?tab=closet" className="btn btn-primary mt-6">Shop Closet Picks</Link>
        </div>
      )}

      <p className="dim mt-3 text-sm" data-testid="amazon-disclosure">{AMAZON_ASSOCIATES_DISCLOSURE}</p>

      {tomorrow ? (
        <aside className="dp-tomorrow mt-6" data-testid="daily-pick-tomorrow" aria-label="Tomorrow's pick (sellers only)">
          <div className="dp-thumb"><Media pick={tomorrow.pick} className="h-full w-full" /></div>
          <div className="min-w-0 flex-1">
            <p className="t-eyebrow">Sneak peek · {fmtDate(tomorrow.date, { weekday: "short", month: "short", day: "numeric" })} · sellers only</p>
            <p className="truncate font-semibold">{tomorrow.pick.title}</p>
            <p className="dim line-clamp-2 text-sm">{tomorrow.why}</p>
          </div>
        </aside>
      ) : null}

      {!compact ? (
        <div className="mt-10">
          <h3 className="t-h3 mb-3">Past daily picks</h3>
          {history.length ? (
            <ol className="dp-history" data-testid="daily-pick-history">
              {history.map((h) => (
                <li key={h.date}>
                  <AffiliateLink item={h.pick} className="dp-hist-item">
                    <span className="dp-thumb sm"><Media pick={h.pick} className="h-full w-full" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="dim block text-xs font-semibold uppercase tracking-wider">{fmtDate(h.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span className="line-clamp-2 block font-semibold leading-snug">{h.pick.title}</span>
                    </span>
                    <ExternalIcon className="h-4 w-4 shrink-0 text-[var(--sky)]" />
                  </AffiliateLink>
                </li>
              ))}
            </ol>
          ) : (
            <p className="panel dim px-5 py-6 text-sm" data-testid="daily-pick-history-empty">This is the first daily pick. Come back tomorrow and today&apos;s pick will show up here.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
