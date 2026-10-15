import { AffiliateLink } from "@/components/shop/affiliate-link";
import { ExternalIcon } from "@/components/ui/icons";
import type { PublicPick as Item } from "@/lib/shop/public-pick";

export function AffiliateCard({ item }: { item: Item }) {
  return (
    <article className="card">
      <div className="card-media contain">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="grid h-full place-items-center text-4xl" aria-hidden>🖖</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="dim text-xs font-semibold uppercase tracking-wider">Amazon Pick</p>
        <h3 className="line-clamp-3 font-semibold leading-snug">
          <AffiliateLink item={item} className="stretched">{item.title}<span className="sr-only"> (opens Amazon in a new tab)</span></AffiliateLink>
        </h3>
        {item.blurb ? <p className="dim line-clamp-3 text-sm leading-snug">{item.blurb}</p> : null}
        <p className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-[var(--sky)]">View on Amazon <ExternalIcon className="h-4 w-4" /></p>
      </div>
    </article>
  );
}
