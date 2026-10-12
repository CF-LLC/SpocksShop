import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/product-card";
import { SectionHeading } from "@/components/section-heading";
import { CatalogLabel } from "@/components/visual/catalog-label";
import { categories, conditionFilterOptions } from "@/lib/data";
import { getClosetProducts } from "@/lib/catalog";
import { numberFromQuery } from "@/lib/utils";
import { AmazonPicks } from "@/components/shop/amazon-picks";
import { CommunityMarket } from "@/components/shop/community-market";
import { communitySellersEnabled } from "@/lib/features";
import { SHOP_SECTIONS } from "@/lib/shop/sections";
import { activeAffiliateItems, approvedCommunityListings } from "@/lib/shop/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse all currently available finds at Spock's Resale Shop.",
};

const PAGE_SIZE = 8;

type SortOption = "newest" | "price-asc" | "price-desc";

function createShopQuery(
  params: {
    q?: string;
    category?: string;
    condition?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: SortOption;
    page?: string;
  },
  updates: Partial<{
    q: string;
    category: string;
    condition: string;
    minPrice: string;
    maxPrice: string;
    sort: SortOption;
    page: string;
  }>,
) {
  const next = new URLSearchParams();

  const merged = { ...params, ...updates };
  Object.entries(merged).forEach(([key, value]) => {
    if (!value) return;
    if (value === "all") return;
    next.set(key, value);
  });

  return next.toString() ? `/shop?${next.toString()}` : "/shop";
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    condition?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: SortOption;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase();
  const category = params.category?.toLowerCase();
  const condition = params.condition;
  const minPrice = numberFromQuery(params.minPrice);
  const maxPrice = numberFromQuery(params.maxPrice);
  const sort = params.sort ?? "newest";
  const parsedPage = Number(params.page ?? "1");
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  const shopProducts = await getClosetProducts();
  const filteredProducts = shopProducts.filter((product) => {
    if (category && product.category !== category) return false;
    if (condition && product.condition !== condition) return false;
    if (typeof minPrice === "number" && product.price < minPrice) return false;
    if (typeof maxPrice === "number" && product.price > maxPrice) return false;
    if (query) {
      const corpus = [
        product.title,
        product.description,
        product.brand,
        product.subcategory,
        ...product.tags,
      ]
        .join(" ")
        .toLowerCase();
      if (!corpus.includes(query)) return false;
    }
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    return b.dateListed.localeCompare(a.dateListed);
  });

  const totalPages = Math.max(Math.ceil(sortedProducts.length / PAGE_SIZE), 1);
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = sortedProducts.slice(start, start + PAGE_SIZE);
  const [affiliate, community] = await Promise.all([activeAffiliateItems(), approvedCommunityListings()]);
  const sellersEnabled = communitySellersEnabled();

  return (
    <div className="space-y-9">
      {/* Shop header */}
      <section className="surface-dark relative overflow-hidden rounded-3xl px-6 py-10 text-stone-100 sm:px-8">
        <div className="absolute right-0 top-0 h-48 w-48 opacity-20 pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(196,154,85,0.5)" strokeWidth="0.8" strokeDasharray="4 8" />
            <circle cx="100" cy="100" r="40" fill="none" stroke="rgba(196,154,85,0.4)" strokeWidth="0.5" />
            <circle cx="170" cy="100" r="4" fill="rgba(196,154,85,0.8)" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="mb-3 flex flex-wrap gap-2">
            <CatalogLabel label="Resale Catalog" variant="gold" />
            <CatalogLabel label={`${shopProducts.length} Objects`} />
          </div>
          <SectionHeading
            eyebrow=""
            title="Shop the Finds"
            description="Search, sort, and filter catalogued discoveries by category, condition, and price."
          />
        </div>
      </section>

      <nav aria-label="Shop sections" className="flex flex-wrap gap-2">
        {[SHOP_SECTIONS.affiliate, SHOP_SECTIONS.closet, SHOP_SECTIONS.community].map((section) => (
          <a key={section.id} href={`#${section.id}`} className="btn btn-outline">
            {section.title}
          </a>
        ))}
      </nav>

      <AmazonPicks items={affiliate} />

      <section id={SHOP_SECTIONS.closet.id} aria-labelledby="spocks-closet-title" className="space-y-6">
      <header>
        <h2 id="spocks-closet-title" className="font-display text-2xl font-semibold text-slate-900">{SHOP_SECTIONS.closet.title}</h2>
        <p className="text-sm text-slate-600">{SHOP_SECTIONS.closet.blurb}</p>
      </header>
      <section className="surface-panel rounded-2xl p-5">
        <form action="/shop" method="get" className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <label htmlFor="q" className="field-label">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="brand, style, item type..."
              className="field-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="category" className="field-label">
              Category
            </label>
            <select id="category" name="category" defaultValue={params.category ?? ""} className="field-input mt-1">
              <option value="">All</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="condition" className="field-label">
              Condition
            </label>
            <select
              id="condition"
              name="condition"
              defaultValue={params.condition ?? ""}
              className="field-input mt-1"
            >
              <option value="">All</option>
              {conditionFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="minPrice" className="field-label">
              Min $
            </label>
            <input
              id="minPrice"
              name="minPrice"
              type="number"
              min={0}
              defaultValue={params.minPrice ?? ""}
              className="field-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="maxPrice" className="field-label">
              Max $
            </label>
            <input
              id="maxPrice"
              name="maxPrice"
              type="number"
              min={0}
              defaultValue={params.maxPrice ?? ""}
              className="field-input mt-1"
            />
          </div>

          <div>
            <label htmlFor="sort" className="field-label">
              Sort
            </label>
            <select id="sort" name="sort" defaultValue={sort} className="field-input mt-1">
              <option value="newest">Newest</option>
              <option value="price-asc">Price low to high</option>
              <option value="price-desc">Price high to low</option>
            </select>
          </div>

          <input type="hidden" name="page" value="1" />
          <div className="md:col-span-6 flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn btn-primary">
              Apply filters
            </button>
            <Link href="/shop" className="btn btn-outline">
              Reset
            </Link>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-slate-500">
          {sortedProducts.length} result{sortedProducts.length === 1 ? "" : "s"} · page {safePage} of {totalPages}
        </p>
        {(query || category || condition) ? (
          <Link href="/shop" className="font-tech text-[10px] uppercase tracking-[0.12em] text-blue-600 hover:text-blue-800">
            Clear filters ×
          </Link>
        ) : null}
      </div>

      {pageItems.length === 0 ? (
        <EmptyState
          title="No products match these filters"
          description="Try widening your price range or removing a filter."
          ctaLabel="Clear filters"
          ctaHref="/shop"
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2 pt-3">
            <Link
              href={createShopQuery(params, { page: String(Math.max(safePage - 1, 1)) })}
              aria-disabled={safePage === 1}
              className={`btn ${safePage === 1 ? "btn-outline pointer-events-none opacity-50" : "btn-outline"}`}
            >
              Previous
            </Link>
            {Array.from({ length: totalPages }).map((_, index) => {
              const page = index + 1;
              return (
                <Link
                  key={`page-${page}`}
                  href={createShopQuery(params, { page: String(page) })}
                  className={`btn ${page === safePage ? "btn-primary" : "btn-outline"}`}
                >
                  {page}
                </Link>
              );
            })}
            <Link
              href={createShopQuery(params, { page: String(Math.min(safePage + 1, totalPages)) })}
              aria-disabled={safePage === totalPages}
              className={`btn ${
                safePage === totalPages ? "btn-outline pointer-events-none opacity-50" : "btn-outline"
              }`}
            >
              Next
            </Link>
          </nav>
        </>
      )}
      </section>

      <CommunityMarket listings={community} sellersEnabled={sellersEnabled} />
    </div>
  );
}
