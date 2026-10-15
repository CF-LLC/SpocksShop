import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { blogCanonical } from "@/lib/blog/config";
import { blogPaths } from "@/lib/blog/links";
import { publishedPage } from "@/lib/blog/repo";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ page?: string }> };

const TITLE = "SpockShop Blog: Space Gifts, Guides & Explainers";
const DESCRIPTION = "Practical space-themed buying guides, how-tos and plain-English astronomy explainers from Spock's Resale Shop.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const canonical = page > 1 ? `${blogCanonical()}?page=${page}` : blogCanonical();
  return {
    title: { absolute: page > 1 ? `${TITLE} (page ${page})` : TITLE },
    description: DESCRIPTION,
    alternates: { canonical, types: { "application/rss+xml": `${blogCanonical()}rss.xml` } },
    openGraph: { title: TITLE, description: DESCRIPTION, url: canonical, type: "website", siteName: "SpockShop Blog" },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" }).format(d) : "");

export default async function BlogIndex({ searchParams }: Props) {
  const requested = Math.max(1, Number((await searchParams).page) || 1);
  const [{ rows, page, pages }, paths] = await Promise.all([publishedPage(requested), blogPaths()]);
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="dim mb-4 text-sm" data-testid="amazon-disclosure">{AMAZON_ASSOCIATES_DISCLOSURE}</p>
        <p className="t-eyebrow mb-2">Blog</p>
        <h1 className="t-h1">Space gifts, guides &amp; explainers</h1>
        <p className="muted mt-3 max-w-2xl">Practical buying guides, how-tos and plain-English explainers for anyone who likes looking up.</p>
      </header>
      {rows.length ? (
        <ul className="grid gap-4 md:grid-cols-2" data-testid="blog-index">
          {rows.map((p) => (
            <li key={p.id} className="card relative p-5">
              <p className="dim text-xs uppercase tracking-wide">{p.kind.replace("_", " ")} · <time dateTime={p.publishedAt?.toISOString()}>{fmt(p.publishedAt)}</time></p>
              <h2 className="mt-2 text-lg font-semibold leading-snug"><Link href={paths.post(p.slug)} className="stretched">{p.title}</Link></h2>
              <p className="muted mt-2 text-sm">{p.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="First posts are on the way" body="We're writing our first guides." actions={[{ href: "https://spockshop.com/shop?tab=amazon", label: "Browse Amazon Picks" }]} />
      )}
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-3">
          {page > 1 ? <Link className="btn btn-outline" href={paths.page(page - 1)} rel="prev">← Newer</Link> : <span />}
          <span className="dim text-sm">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn btn-outline" href={paths.page(page + 1)} rel="next">Older →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
