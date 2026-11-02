import Link from "next/link";
import { SectionHeader } from "@/components/ui/lcars";
import { PRICES_CENTS, type Design } from "@/lib/drop/config";

const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

/** Homepage spot for the Daily Drop merch: one live design plus a link to the full drop. */
export function DesignOfTheDay({ design }: { design: Design }) {
  return (
    <section aria-labelledby="dotd-title" data-testid="design-of-the-day">
      <SectionHeader id="dotd-title" eyebrow="Merch · The Daily Drop" title="Design of the day" action={<Link href="/drop" className="btn btn-outline">Shop all merch</Link>}>
        Original illustrated tees and hoodies, printed to order.
      </SectionHeader>
      <Link href={`/drop/${design.slug}`} className="panel group grid items-center gap-6 p-6 hover:border-[var(--line-strong)] md:grid-cols-[minmax(0,280px)_1fr]">
        <span className="block overflow-hidden rounded-2xl bg-[var(--space-1,#0a1022)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- same static art the /drop grid uses */}
          <img src={`/drop/art/${design.file}.webp`} alt={design.title} loading="lazy" className="aspect-square w-full object-contain" />
        </span>
        <span className="flex flex-col gap-2">
          <span aria-hidden className="h-1.5 w-12 rounded-full" style={{ background: "var(--gold)" }} />
          <span className="t-h3 mt-2">{design.title}</span>
          <span className="muted text-sm">{design.blurb}</span>
          <span className="dim mt-3 text-sm font-semibold">Tees from {usd(PRICES_CENTS.tee)}, hoodies {usd(PRICES_CENTS.hoodie)} →</span>
        </span>
      </Link>
    </section>
  );
}
