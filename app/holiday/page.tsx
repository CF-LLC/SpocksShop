import type { Metadata } from "next";
import Link from "next/link";
import { BuyDirectNote } from "@/components/shop/buy-direct-note";
import { AffiliateCard } from "@/components/shop/affiliate-card";
import { ClosetShippingNote } from "@/components/shop/closet-shipping-note";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getClosetProducts } from "@/lib/catalog";
import { listActiveShippingRates } from "@/lib/commerce/shipping-rates";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";
import { activeAffiliateItems, type AffiliateCard as AffiliateItem } from "@/lib/shop/queries";
import {
  GIFT_GUIDE_SECTIONS,
  HOLIDAY_PATH,
  inGiftSection,
  type GiftSectionId,
} from "@/lib/shop/holiday-gifts";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Holiday gift guide",
  description:
    "Holiday gifts from Closet Picks and Amazon Picks: under $10, white elephant ideas, and gifts for him and her. As an Amazon Associate I earn from qualifying purchases. Live long and prosper.",
  alternates: { canonical: HOLIDAY_PATH },
};

const grid = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4";

export default async function HolidayPage() {
  const [products, picks, rates] = await Promise.all([getClosetProducts(), activeAffiliateItems(), listActiveShippingRates()]);
  const sections = GIFT_GUIDE_SECTIONS.map((s) => ({
    ...s,
    closet: inGiftSection(products, s.id),
    amazon: inGiftSection(picks, s.id),
  }));
  const total = sections.reduce((n, s) => n + s.closet.length + s.amazon.length, 0);
  const amazonAnywhere = sections.some((s) => s.amazon.length > 0);

  return (
    <div>
      <header className="mb-8">
        <p className="t-eyebrow mb-2">Holiday gift guide</p>
        <h1 className="t-h1">Gifts from the Closet and Amazon Picks</h1>
        <p className="t-lead mt-3 max-w-2xl">
          Under $10 Closet finds, white elephant ideas, and gifts for him and her, pulled from what is live now. Amazon prices and availability are on Amazon. Live long and prosper.
        </p>
        <ClosetShippingNote rates={rates} />
        <BuyDirectNote />
        {amazonAnywhere ? (
          <p className="dim mt-3 text-sm" data-testid="amazon-disclosure" data-affiliate-disclosure>
            {AMAZON_ASSOCIATES_DISCLOSURE}
          </p>
        ) : null}
        <nav aria-label="Gift guide sections" className="mt-5 flex flex-wrap gap-2">
          {GIFT_GUIDE_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="btn btn-outline text-sm">
              {s.title}
            </a>
          ))}
        </nav>
        <p className="muted mt-3 text-sm">
          <Link href="/shop" className="underline">Browse the full Closet</Link>
          {" · "}
          <Link href="/shop?tab=amazon" className="underline">All Amazon Picks</Link>
        </p>
      </header>

      {total === 0 ? (
        <EmptyState
          icon="🎁"
          title="No matching gifts right now"
          body="Nothing live fits these gift sections at the moment. The full Closet and Amazon Picks are still open, and this page updates as listings change."
          actions={[{ href: "/shop", label: "Shop Closet Picks" }, { href: "/shop?tab=amazon", label: "Amazon Picks" }]}
        />
      ) : (
        sections.map((s) => (
          <GiftBand key={s.id} id={s.id} title={s.title} kicker={s.kicker} closet={s.closet} amazon={s.amazon} />
        ))
      )}
    </div>
  );
}

function GiftBand({
  id, title, kicker, closet, amazon,
}: {
  id: GiftSectionId;
  title: string;
  kicker: string;
  closet: Product[];
  amazon: AffiliateItem[];
}) {
  const count = closet.length + amazon.length;
  const empty = emptyCopy(id);
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="mb-12 scroll-mt-24">
      <div className="mb-5">
        <h2 id={`${id}-title`} className="t-h2">{title}</h2>
        <p className="muted mt-1 text-sm">{kicker}</p>
        <p className="dim text-sm">{count} {count === 1 ? "item" : "items"}</p>
      </div>
      {count === 0 ? (
        <p className="muted">{empty} <Link href="/shop" className="underline">Shop Closet Picks</Link></p>
      ) : (
        <ul className={grid} data-testid={`holiday-grid-${id}`}>
          {closet.map((p, n) => (
            <li key={`c-${p.id}`}><ProductCard product={p} priority={id === "under10" && n < 2} /></li>
          ))}
          {amazon.map((item) => (
            <li key={`a-${item.id}`}><AffiliateCard item={item} /></li>
          ))}
        </ul>
      )}
    </section>
  );
}

function emptyCopy(id: GiftSectionId): string {
  if (id === "under10") return "Nothing under $10 is live in the Closet right now. Check the other sections, or the full Closet.";
  if (id === "whiteElephant") return "No white-elephant matches are live right now. Check the other sections, or the full Closet.";
  if (id === "forHim") return "No ‘for him’ matches are live right now. Check the other sections, or the full Closet.";
  return "No ‘for her’ matches are live right now. Check the other sections, or the full Closet.";
}
