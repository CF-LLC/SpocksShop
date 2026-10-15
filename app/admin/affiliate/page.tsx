import { asc } from "drizzle-orm";
import Link from "next/link";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { AffiliateLink } from "@/components/shop/affiliate-link";
import { AFFILIATE_CATEGORIES } from "@/lib/affiliate/categories";
import { db } from "@/lib/db";
import { affiliateItems } from "@/lib/db/schema";
import { AMAZON_ASSOCIATES_DISCLOSURE, SHOP_SECTIONS } from "@/lib/shop/sections";

type Item = typeof affiliateItems.$inferSelect;

function Fields({ item }: { item?: Item }) {
  return (
    <>
      <input name="title" required placeholder="Title" defaultValue={item?.title} className="field-input sm:col-span-2" />
      <input name="amazonUrl" placeholder="Amazon URL" defaultValue={item?.amazonUrl ?? ""} className="field-input sm:col-span-2" />
      <input name="asin" placeholder="or ASIN" defaultValue={item?.asin ?? ""} className="field-input font-mono" />
      <input name="imageUrl" placeholder="Image URL" defaultValue={item?.imageUrl ?? ""} className="field-input sm:col-span-2" />
      <input name="priceNote" placeholder="Price note (internal, never shown)" title="Stored for reference only. Not shown on the site (Amazon Associates compliance)." defaultValue={item?.priceNote ?? ""} className="field-input" />
      <select name="category" aria-label="Category" defaultValue={item?.category ?? ""} className="field-input">
        <option value="">No category (All only)</option>
        {AFFILIATE_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      <input name="sortOrder" type="number" title="Sort order" defaultValue={item?.sortOrder ?? 0} className="field-input" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Active</label>
    </>
  );
}

export default async function AdminAffiliatePage({ searchParams }: { searchParams: NoticeParams }) {
  const items = await db.select().from(affiliateItems).orderBy(asc(affiliateItems.sortOrder), asc(affiliateItems.title));
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">{SHOP_SECTIONS.affiliate.title}</h1>
      <p className="text-xs text-slate-500">Links always carry tag=mrspock-20. {AMAZON_ASSOCIATES_DISCLOSURE}</p>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="price-compliance-note">
        Prices and star ratings are hidden on the public site for Amazon Associates compliance (they may only be shown via Amazon&apos;s API).
        The price note below is kept for your reference only.
      </p>
      <p><Link href="/admin/affiliate/import" className="text-sm text-blue-700">Bulk import from JSON →</Link></p>
      <AdminNotice {...await searchParams} />
      <form action="/api/admin/affiliate" method="post" className="surface-panel grid gap-3 rounded-2xl p-4 sm:grid-cols-4">
        <h2 className="text-lg font-semibold sm:col-span-4">Add a pick</h2>
        <Fields />
        <button type="submit" className="btn btn-primary">Add</button>
      </form>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border p-4">
            <form action={`/api/admin/affiliate/${item.id}`} method="post" className="grid gap-3 sm:grid-cols-4">
              <Fields item={item} />
              <div className="flex items-center gap-3">
                <button type="submit" name="intent" value="save" className="btn btn-outline">Save</button>
                <button type="submit" name="intent" value="delete" className="btn-text text-red-700">Delete</button>
              </div>
            </form>
            <AffiliateLink item={item} className="mt-2 inline-block text-xs text-blue-700">Test link ↗</AffiliateLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
