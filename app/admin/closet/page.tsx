import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { formatCents } from "@/lib/commerce/money";
import { db } from "@/lib/db";
import { inventory, photos, products } from "@/lib/db/schema";
import { mediaUrl } from "@/lib/media";
import { SHOP_SECTIONS } from "@/lib/shop/sections";

const STATUS_STYLE: Record<string, string> = {
  listed: "bg-emerald-100 text-emerald-900",
  draft: "bg-slate-200 text-slate-800",
  reserved: "bg-amber-100 text-amber-900",
  pending_approval: "bg-amber-100 text-amber-900",
  sold: "bg-sky-100 text-sky-900",
  archived: "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<string, string> = { listed: "Live", draft: "Draft", reserved: "Reserved", pending_approval: "Pending approval", sold: "Sold", archived: "Archived" };

export default async function AdminClosetPage({ searchParams }: { searchParams: NoticeParams }) {
  const rows = await db
    .select({
      id: products.id, sku: products.sku, title: products.title, status: products.status, priceCents: products.priceCents,
      onHand: inventory.quantityOnHand,
      photo: sql<string | null>`(select ${photos.storagePath} from ${photos} where ${photos.productId} = ${products.id} order by ${photos.sortOrder}, ${photos.createdAt} limit 1)`,
      photoCount: sql<number>`(select count(*)::int from ${photos} where ${photos.productId} = ${products.id})`,
    })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(eq(products.source, "closet"))
    .orderBy(desc(products.updatedAt), asc(products.title));
  const live = rows.filter((r) => r.status === "listed").length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{SHOP_SECTIONS.closet.title}</h1>
          <p className="text-sm text-slate-600">{rows.length} item{rows.length === 1 ? "" : "s"} · {live} live</p>
        </div>
        <Link href="/admin/closet/new" className="btn btn-primary">＋ Add item</Link>
      </div>
      <AdminNotice {...await searchParams} />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-4xl" aria-hidden>📦</p>
          <p className="mt-2 font-semibold">No closet items yet</p>
          <p className="mt-1 text-sm text-slate-600">Add your first find: snap a photo, set a price, publish.</p>
          <Link href="/admin/closet/new" className="btn btn-primary mt-4">＋ Add item</Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="admin-product-list">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <Link href={`/admin/closet/${r.id}`} className="shrink-0" aria-label={`Edit ${r.title}`}>
                {r.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(r.photo)} alt="" className="checker h-24 w-24 rounded-xl object-contain" />
                ) : (
                  <span className="grid h-24 w-24 place-items-center rounded-xl bg-slate-100 text-center text-xs text-slate-500">No photo</span>
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/admin/closet/${r.id}`} className="line-clamp-2 font-semibold text-slate-900 hover:underline">{r.title}</Link>
                <p className="mt-0.5 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{formatCents(r.priceCents)}</span> · qty {r.onHand ?? 0} · {r.photoCount} 📷
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  {r.status === "listed" || r.status === "draft" ? (
                    <form action={`/api/admin/closet/${r.id}`} method="post" className="ml-auto">
                      <input type="hidden" name="intent" value={r.status === "listed" ? "unpublish" : "publish"} />
                      <input type="hidden" name="return" value="list" />
                      <button type="submit" className={`btn ${r.status === "listed" ? "btn-outline" : "btn-primary"} px-4 text-sm`}>{r.status === "listed" ? "Unpublish" : "Publish"}</button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
