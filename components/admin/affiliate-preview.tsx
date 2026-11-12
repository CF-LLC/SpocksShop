import { AffiliateLink } from "@/components/shop/affiliate-link";
import { ExternalIcon } from "@/components/ui/icons";
import { affiliateUrlFor } from "@/lib/commerce/affiliate";

/** Shop-card preview for the editor. Image, title, blurb, and the Amazon link only. */
export function AffiliateShopPreview({
  item,
}: {
  item: { title: string; imageUrl?: string | null; blurb?: string | null; amazonUrl?: string | null; asin?: string | null };
}) {
  let linked = true;
  try { affiliateUrlFor(item); } catch { linked = false; }
  return (
    <article className="card max-w-sm" data-testid="affiliate-shop-preview" aria-label="Shop card preview">
      <div className="card-media contain">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote product photo, same as the public card
          <img src={item.imageUrl} alt="" />
        ) : (
          <div className="grid h-full place-items-center text-4xl" aria-hidden>🖖</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="dim text-xs font-semibold uppercase tracking-wider">Amazon Pick</p>
        <h3 className="line-clamp-3 font-semibold leading-snug">{item.title || "Title"}</h3>
        {item.blurb ? <p className="dim line-clamp-3 text-sm leading-snug">{item.blurb}</p> : <p className="text-sm text-amber-800">No blurb yet. The public card will only show the title.</p>}
        <p className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-[var(--sky)]">
          {linked ? (
            <AffiliateLink item={item} className="inline-flex items-center gap-1">
              View on Amazon <ExternalIcon className="h-4 w-4" />
              <span className="sr-only"> (opens Amazon in a new tab)</span>
            </AffiliateLink>
          ) : (
            <span className="inline-flex items-center gap-1">View on Amazon <ExternalIcon className="h-4 w-4" /></span>
          )}
        </p>
      </div>
    </article>
  );
}
