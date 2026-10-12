import { asc } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { AffiliateLink } from "@/components/shop/affiliate-link";
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
      <input name="priceNote" placeholder="Price note, e.g. ~$25" defaultValue={item?.priceNote ?? ""} className="field-input" />
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
