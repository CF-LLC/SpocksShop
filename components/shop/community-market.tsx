import Link from "next/link";
import { formatCents } from "@/lib/commerce/money";
import { mediaUrl } from "@/lib/media";
import { SHOP_SECTIONS } from "@/lib/shop/sections";
import type { CommunityCard } from "@/lib/shop/queries";

export function CommunityMarket({ listings, sellersEnabled }: { listings: CommunityCard[]; sellersEnabled: boolean }) {
  const section = SHOP_SECTIONS.community;
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="space-y-4">
      <header>
        <h2 id={`${section.id}-title`} className="font-display text-2xl font-semibold text-slate-900">{section.title}</h2>
        <p className="text-sm text-slate-600">{section.blurb}</p>
      </header>
      {!sellersEnabled ? (
        <p className="surface-panel rounded-2xl p-5 text-sm text-slate-600">
          Coming soon: local sellers will be able to list their own finds here.
        </p>
      ) : (
        <p className="text-sm">
          <Link href="/sell/signup" className="text-blue-700 hover:text-blue-900">Want to sell here? Apply to be a seller →</Link>
        </p>
      )}
      {listings.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <li key={l.id} className="surface-panel overflow-hidden rounded-2xl p-4">
              {l.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(l.photoPath)} alt={l.title} className="mb-3 aspect-square w-full rounded-xl object-cover" loading="lazy" />
              ) : null}
              <p className="font-medium text-slate-900">{l.title}</p>
              <p className="text-sm text-slate-700">{formatCents(l.priceCents)}</p>
              <p className="text-xs text-slate-500">Sold by {l.sellerName}</p>
            </li>
          ))}
        </ul>
      ) : sellersEnabled ? (
        <p className="text-sm text-slate-500">No listings yet.</p>
      ) : null}
    </section>
  );
}
