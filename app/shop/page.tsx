import type { Metadata } from "next";
import Link from "next/link";
import { DailyPickSection } from "@/components/shop/daily-pick";
import { CommunityCard } from "@/components/shop/community-card";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/lcars";
import { getClosetProducts } from "@/lib/catalog";
import { parseTab, SHOP_TABS, type ShopTab } from "@/lib/nav";
// Affiliate disclosure (AMAZON_ASSOCIATES_DISCLOSURE) is rendered by DailyPickSection.
import { SHOP_SECTIONS } from "@/lib/shop/sections";
import { approvedCommunityListings, type CommunityCard as Listing } from "@/lib/shop/queries";
import { canPreviewTomorrow, getDailyPickView } from "@/lib/shop/daily-pick";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop Closet Picks (one-of-a-kind secondhand finds) and our Amazon Pick of the Day.",
};

type Sort = "newest" | "price-asc" | "price-desc";
const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];

const grid = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; sort?: string }> }) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const q = (params.q ?? "").trim().slice(0, 80);
  const sort: Sort = SORTS.some((s) => s.key === params.sort) ? (params.sort as Sort) : "newest";
  const [closetAll, community, preview] = await Promise.all([getClosetProducts(), approvedCommunityListings(), canPreviewTomorrow()]);
  const daily = await getDailyPickView({ includeTomorrow: preview, historyDays: tab === "amazon" ? 30 : 0 });

  const needle = q.toLowerCase();
  const closet = closetAll
    .filter((p) => !needle || [p.title, p.description, p.brand, p.categoryName ?? ""].join(" ").toLowerCase().includes(needle))
    .sort((a, b) => (sort === "price-asc" ? a.priceCents - b.priceCents : sort === "price-desc" ? b.priceCents - a.priceCents : b.listedAt.localeCompare(a.listedAt)));
  // Approved seller listings are part of Closet Picks (shown after closet items).
  const sellerItems = community
    .filter((l) => !needle || [l.title, l.description, l.sellerName].join(" ").toLowerCase().includes(needle))
    .sort((a, b) => (sort === "price-asc" ? a.priceCents - b.priceCents : sort === "price-desc" ? b.priceCents - a.priceCents : 0));
  const closetTotal = closetAll.length + community.length;

  const pickCount = daily.today ? 1 : 0;
  const counts: Record<ShopTab, number> = { all: closetTotal + pickCount, amazon: pickCount, closet: closetTotal };

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
          <DailyPickSection view={daily} compact />
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
            <EmptyState icon="🔍" title={`No closet items match "${q}"`} body="Try a different word, or clear the search." actions={[{ href: "/shop?tab=closet", label: "Clear search" }, { href: "/shop?tab=amazon", label: "See today's Amazon pick" }]} />
          ) : (
            <ClosetSection items={closet} sellerItems={sellerItems} total={closetTotal} />
          )}
        </>
      ) : null}

      {tab === "amazon" ? <DailyPickSection view={daily} /> : null}
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
          body="New finds are added as they're photographed. Check back soon, or see today's Amazon pick."
          actions={[{ href: "/shop?tab=amazon", label: "See today's Amazon pick" }, { href: "/contact", label: "Ask what's coming" }]}
        />
      )}
    </section>
  );
}
