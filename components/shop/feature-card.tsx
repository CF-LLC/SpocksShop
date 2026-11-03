import Link from "next/link";
import { AffiliateLink } from "@/components/shop/affiliate-link";
import { sizedImg } from "@/lib/drop/mockups";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";
import type { Feature } from "@/lib/shop/features";

const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

/** Full-width "scrolling ad" card between Closet rows: an Amazon pick or a Daily Drop design. */
export function FeatureCard({ feature: f }: { feature: Feature }) {
  const box = "panel grid items-center gap-5 overflow-hidden p-4 sm:p-6 md:grid-cols-[minmax(0,260px)_1fr]";
  if (f.kind === "amazon") {
    return (
      <aside className={box} data-feature="amazon" aria-label="Amazon Pick (affiliate link)">
        <span className="block overflow-hidden rounded-2xl bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Amazon image */}
          <img src={f.image} alt="" loading="lazy" referrerPolicy="no-referrer" width={260} height={260} className="mx-auto aspect-square w-full max-w-[260px] object-contain" />
        </span>
        <span className="flex flex-col gap-2">
          <span className="t-eyebrow" style={{ color: "var(--lilac)" }}>Amazon Pick</span>
          <span className="t-h3 line-clamp-2">{f.title}</span>
          <span className="muted line-clamp-3 text-sm">{f.line}</span>
          <AffiliateLink item={f} className="btn btn-primary mt-2 self-start">
            See it on Amazon<span className="sr-only"> (opens Amazon in a new tab)</span>
          </AffiliateLink>
          <span className="dim text-xs" data-affiliate-disclosure>{AMAZON_ASSOCIATES_DISCLOSURE}</span>
        </span>
      </aside>
    );
  }
  return (
    <aside className={box} data-feature="drop" aria-label="Daily Drop merch">
      <Link href={`/drop/${f.slug}`} className="relative block overflow-hidden rounded-2xl bg-white" tabIndex={-1} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- static mockup served by /drop/art */}
        <img {...sizedImg(f.image, "(max-width: 768px) 92vw, 260px")} alt="" loading="lazy" width={480} height={480} className="aspect-square w-full object-contain" />
        {f.hoodie ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sizedImg(f.hoodie).src} alt="" loading="lazy" width={64} height={64} className="absolute bottom-2 right-2 h-16 w-16 rounded-lg border border-[var(--line)] bg-white object-cover" />
        ) : null}
      </Link>
      <span className="flex flex-col gap-2">
        <span className="t-eyebrow" style={{ color: "var(--gold)" }}>Merch · The Daily Drop</span>
        <Link href={`/drop/${f.slug}`} className="t-h3 hover:underline">{f.title}</Link>
        <span className="muted text-sm">{f.line}</span>
        <span className="dim text-sm font-semibold">Tees from {usd(f.fromCents)}, hoodies and more</span>
        <Link href={`/drop/${f.slug}`} className="btn btn-primary mt-2 self-start">Shop this design</Link>
      </span>
    </aside>
  );
}
