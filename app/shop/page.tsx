import type { Metadata } from "next";
import Link from "next/link";
import { DailyPickSection } from "@/components/shop/daily-pick";
import { CommunityCard } from "@/components/shop/community-card";
import { FeatureCard } from "@/components/shop/feature-card";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getClosetProducts } from "@/lib/catalog";
// Affiliate disclosure (AMAZON_ASSOCIATES_DISCLOSURE) is rendered by DailyPickSection and on every Amazon FeatureCard.
import { SHOP_SECTIONS } from "@/lib/shop/sections";
import { approvedCommunityListings, type CommunityCard as Listing } from "@/lib/shop/queries";
import { canPreviewTomorrow, getDailyPickView } from "@/lib/shop/daily-pick";
import { alternate, applyClosetQuery, closetHref, facets, FEATURE_EVERY, interleave, PAGE_SIZE, parseClosetQuery, SORTS, type ClosetQuery } from "@/lib/shop/closet-filters";
import { amazonFeatures, dropFeatures, type Feature } from "@/lib/shop/features";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop Closet Picks",
  description: "Shop Closet Picks: one-of-a-kind secondhand finds. Filter by category, size and price.",
};

const grid = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4";

type Entry = { key: string; title: string; description: string; brand?: string; priceCents: number; listedAt?: string } & ({ type: "product"; product: Product } | { type: "listing"; listing: Listing });

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  // Legacy Amazon tab stays reachable (many links point at it); the /shop tab itself is Closet Picks only.
  if (params.tab === "amazon") {
    // includeTomorrow: preview lets staff see tomorrow's pick.
    const preview = await canPreviewTomorrow();
    const daily = await getDailyPickView({ includeTomorrow: preview, historyDays: 30 });
    return (
      <div>
        <header className="mb-6"><p className="t-eyebrow mb-2">Shop</p><h1 className="t-h1">Amazon Pick of the Day</h1>
          <p className="muted mt-2"><Link href="/shop" className="underline">Back to Closet Picks</Link></p></header>
        <DailyPickSection view={daily} />
      </div>
    );
  }

  const query = parseClosetQuery(params);
  const [closetAll, community, amazon] = await Promise.all([getClosetProducts(), approvedCommunityListings(), amazonFeatures()]);
  const all: Entry[] = [
    ...closetAll.map((p): Entry => ({ type: "product", product: p, key: p.id, title: p.title, description: p.description, brand: p.brand, priceCents: p.priceCents, listedAt: p.listedAt })),
    ...community.map((l): Entry => ({ type: "listing", listing: l, key: `l-${l.id}`, title: l.title, description: l.description, brand: l.sellerName, priceCents: l.priceCents, listedAt: "" })),
  ];
  const f = facets(all);
  const matches = applyClosetQuery(all, query);
  const shown = matches.slice(0, query.page * PAGE_SIZE);
  const features: Feature[] = alternate<Feature, Feature>(amazon, dropFeatures());
  const rows = interleave(shown, features, FEATURE_EVERY);
  const filtered = Boolean(query.q || query.cat || query.size || query.price);
  const s = SHOP_SECTIONS.closet;

  return (
    <div>
      <header className="mb-5">
        <p className="t-eyebrow mb-2">Shop</p>
        <h1 className="t-h1">{s.title}</h1>
        <p className="muted mt-2 max-w-2xl">{s.blurb}</p>
      </header>

      {all.length > 0 ? <Filters query={query} f={f} total={matches.length} filtered={filtered} /> : null}

      {all.length === 0 ? (
        <EmptyState icon="🧳" title="Nothing in the closet right now" body="New finds are added as they're photographed. Check back soon."
          actions={[{ href: "/drop", label: "Shop merch" }, { href: "/shop?tab=amazon", label: "See today's Amazon pick" }]} />
      ) : matches.length === 0 ? (
        <EmptyState icon="🔍" title="No closet items match these filters" body="Try a different filter, or clear them." actions={[{ href: "/shop", label: "Clear filters" }]} />
      ) : (
        <section aria-label={`${s.title} results`} id={s.id}>
          <ul className={grid} data-testid="closet-grid">
            {rows.map((r, n) =>
              r.kind === "item" ? (
                <li key={r.item.key}>{r.item.type === "product" ? <ProductCard product={r.item.product} priority={n < 2} /> : <CommunityCard item={r.item.listing} />}</li>
              ) : (
                <li key={`f-${n}`} className="col-span-full my-2">
                  <FeatureCard feature={r.feature} />
                </li>
              ),
            )}
          </ul>
          {matches.length > shown.length ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Link href={closetHref(query, { page: query.page + 1 })} scroll={false} className="btn btn-outline" data-testid="load-more">Load more</Link>
              <span className="dim text-sm">Showing {shown.length} of {matches.length}</span>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

function Filters({ query, f, total, filtered }: { query: ClosetQuery; f: ReturnType<typeof facets>; total: number; filtered: boolean }) {
  const row = (label: string, field: "cat" | "size" | "price", opts: { slug: string; label: string; n: number }[]) =>
    opts.length > 1 ? (
      <div className="flex items-center gap-3">
        <span className="field-label hidden w-20 shrink-0 sm:block">{label}</span>
        <nav aria-label={`Filter by ${label.toLowerCase()}`} className="tabs chip-row -mx-4 px-4 sm:mx-0 sm:px-0">
          <Link href={closetHref(query, { [field]: null })} className="tab" aria-current={!query[field] ? "page" : undefined} scroll={false}>{field === "cat" ? "All" : `Any ${label.toLowerCase()}`}</Link>
          {opts.map((o) => (
            <Link key={o.slug} href={closetHref(query, { [field]: query[field] === o.slug ? null : o.slug })} className="tab" aria-current={query[field] === o.slug ? "page" : undefined} scroll={false}>
              {o.label} <span className="count">{o.n}</span>
            </Link>
          ))}
        </nav>
      </div>
    ) : null;
  return (
    <div className="mb-8 space-y-3" data-testid="closet-filters">
      <form className="flex flex-wrap items-end gap-3" action="/shop" role="search">
        {query.cat ? <input type="hidden" name="cat" value={query.cat} /> : null}
        {query.size ? <input type="hidden" name="size" value={query.size} /> : null}
        {query.price ? <input type="hidden" name="price" value={query.price} /> : null}
        <label className="min-w-0 flex-1 basis-48">
          <span className="field-label mb-1">Search the closet</span>
          <input name="q" defaultValue={query.q} className="field-input" placeholder="Search by name or brand" />
        </label>
        <label>
          <span className="field-label mb-1">Sort</span>
          <select name="sort" defaultValue={query.sort} className="field-input">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <button className="btn btn-outline" type="submit">Apply</button>
      </form>
      {row("Category", "cat", f.categories)}
      {row("Size", "size", f.sizes)}
      {row("Price", "price", f.prices)}
      <p className="dim text-sm" aria-live="polite">
        {total} {total === 1 ? "item" : "items"}{filtered ? <> · <Link href={closetHref({ ...query, q: "", cat: null, size: null, price: null })} className="underline">Clear filters</Link></> : null}
      </p>
    </div>
  );
}
