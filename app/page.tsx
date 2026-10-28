import Link from "next/link";
import { SpaceHero } from "@/components/space-hero";
import { SellCta } from "@/components/sell-cta";
import { communitySellersEnabled } from "@/lib/features";
import { AffiliateCard } from "@/components/shop/affiliate-card";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/lcars";
import { getClosetProducts } from "@/lib/catalog";
import { AMAZON_ASSOCIATES_DISCLOSURE, SHOP_SECTIONS } from "@/lib/shop/sections";
import { activeAffiliateItems, approvedCommunityListings } from "@/lib/shop/queries";
import { plural } from "@/lib/utils";

export default async function HomePage() {
  const [closet, picks, community] = await Promise.all([getClosetProducts(), activeAffiliateItems(), approvedCommunityListings()]);
  // Seller-listed items (if any are approved) are part of Closet Picks.
  const closetCount = closet.length + community.length;

  const sections = [
    { href: "/shop?tab=closet", title: SHOP_SECTIONS.closet.title, blurb: SHOP_SECTIONS.closet.blurb, count: closetCount, unit: "item", accent: "var(--gold)" },
    { href: "/shop?tab=amazon", title: SHOP_SECTIONS.affiliate.title, blurb: SHOP_SECTIONS.affiliate.blurb, count: picks.length, unit: "pick", accent: "var(--lilac)" },
  ];

  return (
    <div className="space-y-16 md:space-y-24">
      <SpaceHero />

      <section aria-labelledby="sections-title">
        <SectionHeader id="sections-title" eyebrow="Two ways to shop" title="Pick a section" />
        <ul className="grid gap-4 md:grid-cols-2">
          {sections.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="panel group flex h-full min-h-[44px] flex-col gap-2 p-6 hover:border-[var(--line-strong)]">
                <span aria-hidden className="h-1.5 w-12 rounded-full" style={{ background: s.accent }} />
                <span className="t-h3 mt-2">{s.title}</span>
                <span className="muted text-sm">{s.blurb}</span>
                <span className="dim mt-auto pt-3 text-sm font-semibold">{s.count ? plural(s.count, s.unit) : "Nothing listed yet"} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="closet-title">
        <SectionHeader id="closet-title" eyebrow="Closet Picks" title="Latest finds" action={closet.length ? <Link href="/shop?tab=closet" className="btn btn-outline">View all</Link> : null}>
          Every item is one of a kind. When it&apos;s gone, it&apos;s gone.
        </SectionHeader>
        {closet.length ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {closet.slice(0, 4).map((p, i) => <li key={p.id}><ProductCard product={p} priority={i < 2} /></li>)}
          </ul>
        ) : (
          <EmptyState
            icon="🧳"
            title="The closet is being restocked"
            body="New one-of-a-kind finds are photographed and listed here first. In the meantime, check out our Amazon Picks."
            actions={[{ href: "/shop?tab=amazon", label: "Browse Amazon Picks" }, { href: "/contact", label: "Ask about an item" }]}
          />
        )}
      </section>

      <section aria-labelledby="picks-title">
        <SectionHeader id="picks-title" eyebrow="Amazon Picks" title="Recommended on Amazon" action={picks.length ? <Link href="/shop?tab=amazon" className="btn btn-outline">All {picks.length} picks</Link> : null}>
          <span className="text-sm">{AMAZON_ASSOCIATES_DISCLOSURE}</span>
        </SectionHeader>
        {picks.length ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {picks.slice(0, 8).map((item) => <li key={item.id}><AffiliateCard item={item} /></li>)}
          </ul>
        ) : (
          <EmptyState title="Picks are on the way" body="We're choosing what to recommend." actions={[{ href: "/shop", label: "Browse the shop" }]} />
        )}
      </section>

      {communitySellersEnabled() ? <SellCta /> : null}
    </div>
  );
}
