import Link from "next/link";
import { OrbitalDecoration } from "@/components/visual/orbital-decoration";
import { Constellation } from "@/components/visual/constellation";

export const SELL_CTA_HREF = "/sell/signup";

export const SELL_BENEFITS = [
  { icon: "🚀", title: "List in minutes", body: "Create a free seller account, add photos and a price, and launch after a quick review." },
  { icon: "🛰️", title: "Simple, fair fees", body: "Keep 95% of each sale. The 5% fee ($1 minimum) applies only when an item sells." },
  { icon: "💫", title: "Paid out by Stripe", body: "Secure Stripe payouts land 3 days after your buyer's package is delivered." },
] as const;

/** Home page "Sell on SpockShop" call to action. Only rendered when seller signup is enabled. */
export function SellCta() {
  return (
    <section aria-labelledby="sell-title" className="sell-cta surface-dark relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)]">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 opacity-40" aria-hidden>
        <div className="sell-orbit h-full w-full"><OrbitalDecoration size="lg" accent="gold" rings={3} /></div>
      </div>
      <div className="pointer-events-none absolute -bottom-10 left-0 h-40 w-56 opacity-30" aria-hidden>
        <Constellation points={8} lineColor="rgba(196,154,85,0.4)" dotColor="rgba(196,154,85,0.7)" />
      </div>
      <div className="relative z-10 grid gap-10 px-6 py-12 sm:px-10 md:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="t-eyebrow">Sell on SpockShop</p>
          <h2 id="sell-title" className="font-display mt-3 text-[clamp(1.9rem,4.5vw,3rem)] font-bold leading-[1.02] tracking-tight text-stone-50">
            Turn your closet into a <span className="text-[var(--gold-light)]">launchpad.</span>
          </h2>
          <p className="mt-4 max-w-md text-stone-300">Have one-of-a-kind finds? Open your own corner of the shop and reach buyers across the galaxy.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={SELL_CTA_HREF} className="btn btn-primary sell-cta-btn">Start selling →</Link>
            <Link href="/sell/terms" className="btn btn-outline">Read seller terms</Link>
          </div>
          <p className="hero-tech mt-5 text-[11px] tracking-[0.2em] text-stone-500 uppercase">🖖 Live long and prosper.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {SELL_BENEFITS.map((b, i) => (
            <li key={b.title} className="sell-benefit flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm" style={{ animationDelay: `${0.1 + i * 0.12}s` }}>
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(196,154,85,0.45)] bg-[rgba(196,154,85,0.12)] text-xl">{b.icon}</span>
              <span>
                <span className="block font-semibold text-stone-50">{b.title}</span>
                <span className="mt-1 block text-sm text-stone-400">{b.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
