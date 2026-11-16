import type { Metadata } from "next";
import Link from "next/link";
import { BuyDirectNote } from "@/components/shop/buy-direct-note";
import { ClosetShippingNote } from "@/components/shop/closet-shipping-note";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getClosetProducts } from "@/lib/catalog";
import { listActiveShippingRates } from "@/lib/commerce/shipping-rates";
import { HOLIDAY_PATH, holidayGiftSections } from "@/lib/shop/holiday-gifts";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Holiday gifts from the Closet",
  description:
    "One-of-a-kind Closet Picks under $10 and under $20 at Spock's Resale Shop. Bundle a few and pay one shipping fee per US order. Live long and prosper.",
  alternates: { canonical: HOLIDAY_PATH },
};

const grid = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4";

export default async function HolidayPage() {
  const [products, rates] = await Promise.all([getClosetProducts(), listActiveShippingRates()]);
  const { under10, from10to20, total } = holidayGiftSections(products);

  return (
    <div>
      <header className="mb-8">
        <p className="t-eyebrow mb-2">Holiday gifts</p>
        <h1 className="t-h1">Gifts from the Closet</h1>
        <p className="t-lead mt-3 max-w-2xl">One-of-a-kind secondhand finds under $10 and under $20, pulled from what&apos;s live in Closet Picks right now. Live long and prosper.</p>
        <ClosetShippingNote rates={rates} />
        <BuyDirectNote />
        <p className="muted mt-3 text-sm">
          <Link href="/shop" className="underline">Browse the full Closet</Link>
        </p>
      </header>

      {total === 0 ? (
        <EmptyState
          icon="🎁"
          title="No gift-priced Closet items right now"
          body="Nothing live is under $20 at the moment. The full Closet is still open, and this page updates as listings change."
          actions={[{ href: "/shop", label: "Shop Closet Picks" }]}
        />
      ) : (
        <>
          <GiftBand id="under-10" title="Under $10" items={under10} empty="Nothing under $10 is live right now. Check the $10–$20 finds below, or the full Closet." />
          <GiftBand id="under-20" title="Under $20" kicker="$10 to $19.99" items={from10to20} empty="Nothing in the $10–$20 range is live right now. Check the under $10 finds above, or the full Closet." />
        </>
      )}
    </div>
  );
}

function GiftBand({ id, title, kicker, items, empty }: { id: string; title: string; kicker?: string; items: Product[]; empty: string }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="mb-12">
      <div className="mb-5">
        <h2 id={`${id}-title`} className="t-h2">{title}</h2>
        {kicker ? <p className="muted mt-1 text-sm">{kicker}</p> : null}
        <p className="dim text-sm">{items.length} {items.length === 1 ? "item" : "items"}</p>
      </div>
      {items.length === 0 ? (
        <p className="muted">{empty} <Link href="/shop" className="underline">Shop Closet Picks</Link></p>
      ) : (
        <ul className={grid} data-testid={`holiday-grid-${id}`}>
          {items.map((p, n) => (
            <li key={p.id}><ProductCard product={p} priority={n < 2} /></li>
          ))}
        </ul>
      )}
    </section>
  );
}
