import Link from "next/link";
import { SectionHeader } from "@/components/ui/lcars";
import { PRICES_CENTS, type Design } from "@/lib/drop/config";
import { artUrl, heroImage, mockupUrl, sizedImg } from "@/lib/drop/mockups";

const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

/** Homepage spot for the Daily Drop merch: one live design plus a link to the full drop. */
export function DesignOfTheDay({ design }: { design: Design }) {
  return (
    <section aria-labelledby="dotd-title" data-testid="design-of-the-day">
      <SectionHeader id="dotd-title" eyebrow="Merch · The Daily Drop" title="Design of the day" action={<Link href="/drop" className="btn btn-outline">Shop all merch</Link>}>
        Original illustrated tees, hoodies, mugs, stickers and hats, printed to order.
      </SectionHeader>
      <Link href={`/drop/${design.slug}`} className="panel group grid items-center gap-6 p-6 hover:border-[var(--line-strong)] md:grid-cols-[minmax(0,280px)_1fr]">
        <span className={`relative block overflow-hidden rounded-2xl ${mockupUrl(design, "tee") ? "bg-white" : "bg-[var(--space-1,#0a1022)]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static mockup/art served by /drop/art */}
          <img {...sizedImg(heroImage(design), "(max-width: 768px) 92vw, 420px")} width={480} height={480} alt={`${design.title} on a tee`} loading="lazy" className="aspect-square w-full object-contain" />
          {mockupUrl(design, "hoodie") ? (
            <span className="absolute bottom-2 right-2 flex gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sizedImg(mockupUrl(design, "hoodie")!).src} alt={`${design.title} on a hoodie`} loading="lazy" className="h-16 w-16 rounded-lg border border-[var(--line)] bg-white object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sizedImg(artUrl(design)).src} alt="" loading="lazy" className="h-16 w-16 rounded-lg border border-[var(--line)] bg-[var(--space-1,#0a1022)] object-contain p-1" />
            </span>
          ) : null}
        </span>
        <span className="flex flex-col gap-2">
          <span aria-hidden className="h-1.5 w-12 rounded-full" style={{ background: "var(--gold)" }} />
          <span className="t-h3 mt-2">{design.title}</span>
          <span className="muted text-sm">{design.blurb}</span>
          <span className="dim mt-3 text-sm font-semibold">Tees {usd(PRICES_CENTS.tee)}, mugs from {usd(PRICES_CENTS.mug)}, stickers from {usd(PRICES_CENTS.sticker)}, hats {usd(PRICES_CENTS.hat)} →</span>
        </span>
      </Link>
    </section>
  );
}
