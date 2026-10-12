import type { Metadata } from "next";
import Link from "next/link";
import { HeroSection } from "@/components/hero-section";
import { CategoryCard } from "@/components/category-card";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { ProductCard } from "@/components/product-card";
import { SectionHeading } from "@/components/section-heading";
import { Reveal } from "@/components/reveal";
import { OrbitalDecoration } from "@/components/visual/orbital-decoration";
import { Constellation } from "@/components/visual/constellation";
import { TechnicalGrid } from "@/components/visual/technical-grid";
import { CatalogLabel } from "@/components/visual/catalog-label";
import {
  categories,
  featuredProducts,
  getProductById,
  huntEntries,
  justDiscovered,
} from "@/lib/data";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Discover one-of-a-kind secondhand finds at Spock's Resale Shop. Curated, inspected, and constantly rotating inventory.",
};

const whyShopItems = [
  {
    icon: "◎",
    label: "One-of-a-kind finds",
    detail: "Every object is individually sourced. When it's gone, it's gone.",
  },
  {
    icon: "◈",
    label: "Affordable prices",
    detail: "Resale value without the resale guesswork. Fair pricing, always.",
  },
  {
    icon: "◆",
    label: "Carefully inspected",
    detail: "Condition notes that respect your time and trust.",
  },
  {
    icon: "◉",
    label: "Fresh discoveries",
    detail: "New items catalogued from every expedition. Check back often.",
  },
];

export default function HomePage() {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "Spock's Resale Shop",
    slogan: "Live Long and Prosper",
    description:
      "Curated ecommerce resale store featuring unique secondhand products and constantly changing inventory.",
    url: "https://spockshop.com",
  };

  return (
    <div className="space-y-20 md:space-y-28">

      {/* ── HERO ── */}
      <HeroSection />

      {/* ── JUST DISCOVERED ── */}
      <section className="section-wrap">
        <Reveal animation="reveal-up">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionHeading
                eyebrow="Newly catalogued"
                title="JUST DISCOVERED"
                description="Fresh finds from the latest expedition."
              />
            </div>
            <Link href="/shop?sort=newest" className="btn btn-outline">
              View All Finds →
            </Link>
          </div>
        </Reveal>

        <div className="stagger-children grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {justDiscovered.map((product, i) => (
            <Reveal key={product.id} animation="reveal-up" delay={i * 80}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="section-wrap">
        <Reveal animation="reveal-fade">
          <SectionHeading
            eyebrow="Browse by department"
            title="Where will you look today?"
            description="Every category is sourced from a different kind of hunt."
          />
        </Reveal>

        <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category, i) => (
            <Reveal key={category.slug} animation="reveal-scale" delay={i * 60}>
              <CategoryCard category={category} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── THE HUNT PREVIEW ── */}
      <Reveal animation="reveal-up">
        <section className="surface-dark relative overflow-hidden rounded-3xl px-6 py-12 sm:px-10">
          {/* Background decorations */}
          <div className="absolute right-0 top-0 h-64 w-64 opacity-20 pointer-events-none" aria-hidden="true">
            <OrbitalDecoration size="lg" accent="gold" rings={2} />
          </div>
          <div className="absolute -bottom-8 left-8 opacity-15 pointer-events-none" aria-hidden="true">
            <Constellation
              points={9}
              lineColor="rgba(196,154,85,0.5)"
              dotColor="rgba(196,154,85,0.7)"
              animated={false}
            />
          </div>

          <div className="relative z-10">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-eyebrow text-stone-500 mb-2">Discovery Log</p>
                <h2 className="font-display text-display-lg text-stone-50">
                  The Hunt
                </h2>
                <p className="mt-2 max-w-md text-stone-400 text-sm leading-relaxed">
                  Every item has a story. Here&apos;s where we found them.
                </p>
              </div>
              <Link href="/hunt" className="btn btn-accent">
                Open The Hunt
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {huntEntries.slice(0, 2).map((entry) => {
                const product = getProductById(entry.productId);
                if (!product) return null;
                return (
                  <article
                    key={entry.id}
                    className="hunt-entry relative overflow-hidden rounded-xl bg-[#1a2234]/80 border border-stone-700 p-5"
                  >
                    {/* Accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--gold)] to-[var(--rust)]" />

                    <div className="pl-2">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <CatalogLabel
                          label={`Expedition ${entry.id.replace("hunt-", "").padStart(3, "0")}`}
                          variant="gold"
                        />
                        <CatalogLabel
                          label={entry.status === "Available" ? "In the Shop" : "Sold"}
                          variant={entry.status === "Available" ? "green" : "default"}
                        />
                      </div>

                      <h3 className="font-display text-xl text-stone-100">{product.title}</h3>
                      <p className="font-tech mt-1 text-[10px] tracking-[0.14em] uppercase text-stone-500">
                        Found at: {entry.whereDiscovered}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-stone-400 line-clamp-2">
                        {entry.story}
                      </p>
                      <p className="font-tech mt-3 text-[10px] tracking-[0.12em] uppercase text-stone-600">
                        {formatDate(entry.discoveryDate)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── FEATURED FINDS ── */}
      <section className="section-wrap">
        <Reveal animation="reveal-up">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Collector picks"
              title="Featured Finds"
              description="Standout objects with character, value, and a good story."
            />
            <Link href="/shop?sort=featured" className="btn btn-outline">
              Browse All →
            </Link>
          </div>
        </Reveal>

        <div className="stagger-children grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featuredProducts.map((product, i) => (
            <Reveal key={product.id} animation="reveal-up" delay={i * 80}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── WHY SHOP SPOCK'S ── */}
      <Reveal animation="reveal-up">
        <section className="surface-dark relative overflow-hidden rounded-3xl px-6 py-12 text-stone-100 sm:px-10">
          {/* Subtle technical grid in background */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true">
            <TechnicalGrid
              className="absolute bottom-0 right-0 h-full w-full"
              cellSize={50}
              color="rgba(196,154,85,0.6)"
              opacity={1}
              showTarget
            />
          </div>

          <div className="relative z-10">
            <SectionHeading
              eyebrow="Why shop here?"
              title="A curated resale brand."
              description="We blend old-world thrifting instincts with modern catalog discipline."
            />

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {whyShopItems.map((item) => (
                <li
                  key={item.label}
                  className="rounded-xl border border-stone-700/60 bg-[#161e2c]/70 px-5 py-4 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-[var(--gold-light)] text-lg mt-0.5 shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-display text-lg text-stone-100">{item.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-stone-400">{item.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Reveal>

      {/* ── NEWSLETTER ── */}
      <Reveal animation="reveal-up">
        <NewsletterSignup />
      </Reveal>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
    </div>
  );
}
