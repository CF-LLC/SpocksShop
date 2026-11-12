import { AFFILIATE_CATEGORIES } from "@/lib/affiliate/categories";
import type { ImportPreviewCard } from "@/lib/admin/affiliate-catalog";
import { missingCopyLabel, missingCopy } from "@/lib/admin/affiliate-catalog";

const label = (slug?: string) => AFFILIATE_CATEGORIES.find((c) => c.slug === slug)?.label ?? null;

/** Import preview cards. The card type has no price fields. */
export function ImportPreviewGrid({ cards }: { cards: ImportPreviewCard[] }) {
  if (!cards.length) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-testid="import-preview">
      {cards.map((card, index) => {
        const gap = missingCopyLabel(missingCopy(card));
        return (
          <li key={`${card.asin ?? card.title}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote product photo from the import file
              <img src={card.imageUrl} alt="" referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain" />
            ) : (
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-500">No image</span>
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 font-semibold text-slate-900">{card.title}</p>
              {card.blurb ? <p className="mt-1 line-clamp-3 text-sm text-slate-600">{card.blurb}</p> : null}
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {label(card.category) ? <span className="chip">{label(card.category)}</span> : null}
                {card.asin ? <span className="font-mono">{card.asin}</span> : <span>Link only</span>}
              </p>
              {gap ? <p className="mt-1 text-xs font-semibold text-amber-800">{gap}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
