import { AffiliateLink } from "@/components/shop/affiliate-link";
import { AMAZON_ASSOCIATES_DISCLOSURE, SHOP_SECTIONS } from "@/lib/shop/sections";
import type { AffiliateCard } from "@/lib/shop/queries";

export function AmazonPicks({ items }: { items: AffiliateCard[] }) {
  const section = SHOP_SECTIONS.affiliate;
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="space-y-4">
      <header>
        <h2 id={`${section.id}-title`} className="font-display text-2xl font-semibold text-slate-900">{section.title}</h2>
        <p className="text-sm text-slate-600">{section.blurb}</p>
        <p className="mt-1 text-xs text-slate-500">{AMAZON_ASSOCIATES_DISCLOSURE}</p>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Picks are on the way.</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="surface-panel overflow-hidden rounded-2xl">
              <AffiliateLink item={item} className="block h-full p-4 hover:opacity-90">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title} className="mb-3 aspect-square w-full rounded-xl object-contain bg-white" loading="lazy" />
                ) : null}
                <p className="font-medium text-slate-900">{item.title}</p>
                {item.priceNote ? <p className="text-sm text-slate-600">{item.priceNote}</p> : null}
                <p className="mt-2 font-tech text-[10px] uppercase tracking-[0.14em] text-blue-700">View on Amazon ↗</p>
              </AffiliateLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
