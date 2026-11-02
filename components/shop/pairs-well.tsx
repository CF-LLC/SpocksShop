import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateItems } from "@/lib/db/schema";
import { AffiliateLink } from "@/components/shop/affiliate-link";
import { AFFILIATE_DISCLOSURE, type Pairing } from "@/lib/shop/pairings";

/** Secondary "Pairs well with" Amazon block. Renders nothing if none of the curated picks are active. No prices shown. */
export async function PairsWell({ pairing }: { pairing: Pairing | null }) {
  if (!pairing) return null;
  let rows: { title: string; imageUrl: string | null; amazonUrl: string | null; asin: string | null }[] = [];
  try {
    rows = await db.select({ title: affiliateItems.title, imageUrl: affiliateItems.imageUrl, amazonUrl: affiliateItems.amazonUrl, asin: affiliateItems.asin })
      .from(affiliateItems).where(and(eq(affiliateItems.active, true), inArray(affiliateItems.asin, pairing.asins)));
  } catch {
    return null;
  }
  const items = pairing.asins.map((a) => rows.find((r) => r.asin === a)).filter((r) => r !== undefined);
  if (items.length === 0) return null;
  return (
    <aside aria-label="Pairs well with (Amazon affiliate links)" data-pairs-well className="mt-8 rounded-2xl border border-[var(--line,#2a3170)] p-4 text-sm opacity-90">
      <h2 className="mb-1 text-base font-semibold">{pairing.heading}</h2>
      <p className="mb-3 text-xs opacity-75" data-affiliate-disclosure>Amazon Picks we like. {AFFILIATE_DISCLOSURE}</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.asin} className="flex items-center gap-3">
            {i.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg bg-white object-contain p-1" />
            ) : null}
            <AffiliateLink item={i} className="line-clamp-3 leading-snug underline-offset-2 hover:underline">
              {i.title}<span className="sr-only"> (opens Amazon in a new tab)</span>
            </AffiliateLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
