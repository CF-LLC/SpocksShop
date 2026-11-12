import { asc } from "drizzle-orm";
import Link from "next/link";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { AffiliateCatalog, type AffiliateCatalogItem } from "@/app/admin/affiliate/catalog";
import { attributeAffiliateClicks, loadAffiliateClicks } from "@/lib/affiliate/clicks";
import { db } from "@/lib/db";
import { affiliateItems } from "@/lib/db/schema";
import { peekDailyWindow } from "@/lib/shop/daily-pick";
import { AMAZON_ASSOCIATES_DISCLOSURE, SHOP_SECTIONS } from "@/lib/shop/sections";

export default async function AdminAffiliatePage({ searchParams }: { searchParams: NoticeParams }) {
  const [rows, clicks, dailyWindow] = await Promise.all([
    db.select().from(affiliateItems).orderBy(asc(affiliateItems.sortOrder), asc(affiliateItems.title)),
    loadAffiliateClicks(db),
    peekDailyWindow(),
  ]);
  const attributed = attributeAffiliateClicks(rows, clicks.rows);
  const items: AffiliateCatalogItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    fullTitle: row.fullTitle,
    blurb: row.blurb,
    why: row.why,
    imageUrl: row.imageUrl,
    amazonUrl: row.amazonUrl,
    asin: row.asin,
    priceNote: row.priceNote,
    category: row.category,
    active: row.active,
    sortOrder: row.sortOrder,
    clicks: attributed.byId[row.id] ?? { n: 0, d7: 0, d30: 0 },
  }));
  const nextSortOrder = rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
  const toInfo = (pick: { date: string; why: string; locked: boolean; pick: { id: string; title: string } } | null) =>
    pick ? { id: pick.pick.id, title: pick.pick.title, why: pick.why, date: pick.date, locked: pick.locked } : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{SHOP_SECTIONS.affiliate.title}</h1>
        <Link href="/admin/affiliate/import" className="text-sm text-blue-700">Bulk import from JSON</Link>
      </div>
      <p className="text-xs text-slate-500">Links always carry tag=mrspock-20. {AMAZON_ASSOCIATES_DISCLOSURE}</p>
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="price-compliance-note">
        Prices and star ratings are hidden on the public site for Amazon Associates compliance (only Amazon&apos;s API may show them). Any price note is internal.
      </p>
      <AdminNotice {...await searchParams} />
      <AffiliateCatalog
        items={items}
        totals={attributed.totals}
        unattributed={attributed.unattributed}
        daily={clicks.daily}
        today={toInfo(dailyWindow.today)}
        tomorrow={toInfo(dailyWindow.tomorrow)}
        nextSortOrder={nextSortOrder}
      />
    </section>
  );
}
