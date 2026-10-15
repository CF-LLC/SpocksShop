import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AffiliateLink } from "@/components/shop/affiliate-link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ExternalIcon } from "@/components/ui/icons";
import { getPublishedGuide } from "@/lib/guides/load";
import { resolvePicks } from "@/lib/guides/schema";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";
import { activeAffiliateItems } from "@/lib/shop/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const guide = await getPublishedGuide((await params).slug);
  if (!guide) return { title: "Guide not found", robots: { index: false } };
  const description = guide.description || guide.intro.slice(0, 160) || `${guide.title} from Spock's Resale Shop.`;
  const url = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: guide.title, description, url, type: "article", ...(guide.heroImageUrl ? { images: [guide.heroImageUrl] } : {}) },
    twitter: { card: "summary_large_image", title: guide.title, description },
  };
}

export default async function GuidePage({ params }: Params) {
  const guide = await getPublishedGuide((await params).slug);
  if (!guide) notFound();
  const catalog = await activeAffiliateItems();
  // Article JSON-LD only: no product offers, no prices, no review scores.
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description || undefined, dateModified: guide.updatedAt, url: `https://spockshop.com/guides/${guide.slug}` };

  return (
    <article className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="mb-4 rounded-lg border border-[var(--line)] p-3 text-sm" data-testid="amazon-disclosure">{AMAZON_ASSOCIATES_DISCLOSURE}</p>
      <Breadcrumbs items={[{ label: "Guides", href: "/guides" }, { label: guide.title }]} />
      <header className="mb-8 mt-4">
        <p className="t-eyebrow mb-2">Guide</p>
        <h1 className="t-h1">{guide.title}</h1>
        {guide.updatedAt ? <p className="dim mt-2 text-sm">Updated {guide.updatedAt}</p> : null}
        {guide.intro ? <div className="muted mt-4 space-y-3">{guide.intro.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div> : null}
      </header>
      {guide.sections.map((s, si) => {
        const picks = resolvePicks(s.picks, catalog);
        return (
          <section key={si} className="mb-10" aria-labelledby={`guide-s${si}`}>
            <h2 id={`guide-s${si}`} className="mb-2 text-xl font-semibold">{s.heading}</h2>
            {s.intro ? <p className="muted mb-4">{s.intro}</p> : null}
            <ol className="grid gap-4">
              {picks.map((p) => (
                <li key={p.key} className="card flex gap-4 p-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                    ) : <div className="grid h-full place-items-center text-3xl" aria-hidden>🖖</div>}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug">{p.title}</h3>
                    <p className="muted mt-1 text-sm">{p.commentary}</p>
                    <AffiliateLink item={p.link} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sky)]">
                      View on Amazon <ExternalIcon className="h-4 w-4" /><span className="sr-only"> (opens Amazon in a new tab)</span>
                    </AffiliateLink>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </article>
  );
}
