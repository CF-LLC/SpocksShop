import type { Metadata } from "next";
import Link from "next/link";
import { AffiliateCard } from "@/components/shop/affiliate-card";
import { CommunityCard } from "@/components/shop/community-card";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/lcars";
import { getClosetProducts } from "@/lib/catalog";
import { AFFILIATE_CATEGORIES, parseAffiliateCategory, type AffiliateCategory } from "@/lib/affiliate/categories";
import { parseTab, SHOP_TABS, type ShopTab } from "@/lib/nav";
import { AMAZON_ASSOCIATES_DISCLOSURE, SHOP_SECTIONS } from "@/lib/shop/sections";
import { activeAffiliateItems, approvedCommunityListings, type AffiliateCard as Pick, type CommunityCard as Listing } from "@/lib/shop/queries";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop Closet Picks (one-of-a-kind secondhand finds) and Amazon Picks.",
};

type Sort = "newest" | "price-asc" | "price-desc";
const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];

const grid = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; sort?: string; cat?: string }> }) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const q = (params.q ?? "").trim().slice(0, 80);
  const sort: Sort = SORTS.some((s) => s.key === params.sort) ? (params.sort as Sort) : "newest";
  const [closetAll, picks, community] = await Promise.all([getClosetProducts(), activeAffiliateItems(), approvedCommunityListings()]);
  const cat = parseAffiliateCategory(params.cat);

  const needle = q.toLowerCase();
  const closet = closetAll
    .filter((p) => !needle || [p.title, p.description, p.brand, p.categoryName ?? ""].join(" ").toLowerCase().includes(needle))
    .sort((a, b) => (sort === "price-asc" ? a.priceCents - b.priceCents : sort === "price-desc" ? b.priceCents - a.priceCents : b.listedAt.localeCompare(a.listedAt)));
  // Approved seller listings are part of Closet Picks (shown after closet items).
  const sellerItems = community
    .filter((l) => !needle || [l.title, l.description, l.sellerName].join(" ").toLowerCase().includes(needle))
    .sort((a, b) => (sort === "price-asc" ? a.priceCents - b.priceCents : sort === "price-desc" ? b.priceCents - a.priceCents : 0));
  const closetTotal = closetAll.length + community.length;

  const counts: Record<ShopTab, number> = { all: closetTotal + picks.length, amazon: picks.length, closet: closetTotal };

  return (
    <div>
      <header className="mb-6">
        <p className="t-eyebrow mb-2">Shop</p>
        <h1 className="t-h1">{tab === "all" ? "Everything in the shop" : SHOP_TABS.find((t) => t.key === tab)?.label}</h1>
      </header>

      <nav aria-label="Shop sections" className="tabs -mx-4 mb-8 px-4 md:mx-0 md:px-0">
        {SHOP_TABS.map((t) => (
          <Link key={t.key} href={t.href} className="tab" aria-current={t.key === tab ? "page" : undefined} scroll={false}>
            {t.label} <span className="count">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {tab === "all" ? (
        <div className="space-y-16">
          <ClosetSection items={closetAll.slice(0, 8)} sellerItems={community.slice(0, Math.max(0, 8 - closetAll.length))} total={closetTotal} preview />
          <AmazonSection items={picks.slice(0, 8)} total={picks.length} preview />
        </div>
      ) : null}

      {tab === "closet" ? (
        <>
          {closetTotal > 0 ? (
            <form className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end" action="/shop" role="search">
              <input type="hidden" name="tab" value="closet" />
              <label className="flex-1">
                <span className="field-label mb-1">Search the closet</span>
                <input name="q" defaultValue={q} className="field-input" placeholder="Search by name or brand" />
              </label>
              <label>
                <span className="field-label mb-1">Sort</span>
                <select name="sort" defaultValue={sort} className="field-input">
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <button className="btn btn-outline" type="submit">Apply</button>
            </form>
          ) : null}
          {q && closet.length + sellerItems.length === 0 && closetTotal > 0 ? (
            <EmptyState icon="🔍" title={`No closet items match "${q}"`} body="Try a different word, or clear the search." actions={[{ href: "/shop?tab=closet", label: "Clear search" }, { href: "/shop?tab=amazon", label: "Browse Amazon Picks" }]} />
          ) : (
            <ClosetSection items={closet} sellerItems={sellerItems} total={closetTotal} />
          )}
        </>
      ) : null}

      {tab === "amazon" ? <AmazonSection items={cat ? picks.filter((p) => p.category === cat) : picks} total={picks.length} filters={{ active: cat, all: picks }} /> : null}
    </div>
  );
}

function ClosetSection({ items, sellerItems = [], total, preview = false }: { items: Product[]; sellerItems?: Listing[]; total: number; preview?: boolean }) {
  const s = SHOP_SECTIONS.closet;
  return (
    <section aria-labelledby={`${s.id}-title`} id={s.id}>
      <SectionHeader id={`${s.id}-title`} title={s.title} eyebrow={preview ? "One of a kind" : undefined} action={preview && total > items.length + sellerItems.length ? <Link className="btn btn-outline" href="/shop?tab=closet">All {total}</Link> : null}>
        {s.blurb}
      </SectionHeader>
      {items.length + sellerItems.length ? (
        <ul className={grid}>
          {items.map((p, i) => <li key={p.id}><ProductCard product={p} priority={i < 2} /></li>)}
          {sellerItems.map((l) => <li key={`l-${l.id}`}><CommunityCard item={l} /></li>)}
        </ul>
      ) : (
        <EmptyState
          icon="🧳"
          title="Nothing in the closet right now"
          body="New finds are added as they're photographed. Check back soon, or browse our Amazon Picks."
          actions={[{ href: "/shop?tab=amazon", label: "Browse Amazon Picks" }, { href: "/contact", label: "Ask what's coming" }]}
        />
      )}
    </section>
  );
}

/** Shareable filter chips: /shop?tab=amazon&cat=spock. Horizontally scrollable on mobile. */
function CategoryChips({ active, all }: { active: AffiliateCategory | null; all: Pick[] }) {
  const chips = [
    ...AFFILIATE_CATEGORIES.map((c) => ({ key: c.slug as string, label: c.label, href: `/shop?tab=amazon&cat=${c.slug}`, count: all.filter((p) => p.category === c.slug).length, current: active === c.slug })),
    { key: "all", label: "All", href: "/shop?tab=amazon", count: all.length, current: active === null },
  ];
  return (
    <nav aria-label="Filter Amazon Picks by category" className="chip-row -mx-4 mb-6 px-4 md:mx-0 md:px-0">
      {chips.map((c) => (
        <Link key={c.key} href={c.href} className="chip-filter" aria-current={c.current ? "true" : undefined} scroll={false}>
          {c.label} <span className="count">{c.count}</span>
        </Link>
      ))}
    </nav>
  );
}

function AmazonSection({ items, total, preview = false, filters }: { items: Pick[]; total: number; preview?: boolean; filters?: { active: AffiliateCategory | null; all: Pick[] } }) {
  const s = SHOP_SECTIONS.affiliate;
  return (
    <section aria-labelledby={`${s.id}-title`} id={s.id}>
      <SectionHeader id={`${s.id}-title`} title={s.title} eyebrow={preview ? "Recommended" : undefined} action={preview && total > items.length ? <Link className="btn btn-outline" href="/shop?tab=amazon">All {total}</Link> : null}>
        <p>{s.blurb}</p>
        <p className="dim mt-1 text-sm">{AMAZON_ASSOCIATES_DISCLOSURE} Prices are approximate and may vary on Amazon.</p>
      </SectionHeader>
      {filters && total > 0 ? <CategoryChips active={filters.active} all={filters.all} /> : null}
      {items.length ? (
        <ul className={grid}>{items.map((item) => <li key={item.id}><AffiliateCard item={item} /></li>)}</ul>
      ) : filters?.active ? (
        <EmptyState icon="🛰️" title={`No ${AFFILIATE_CATEGORIES.find((c) => c.slug === filters.active)?.label ?? "matching"} picks yet`} body="We haven't added picks here yet. Try another category, or see every pick." actions={[{ href: "/shop?tab=amazon", label: "Show all picks" }]} />
      ) : (
        <EmptyState title="Picks are on the way" body="We're choosing what to recommend." actions={[{ href: "/shop?tab=closet", label: "Shop Closet Picks" }]} />
      )}
    </section>
  );
}
