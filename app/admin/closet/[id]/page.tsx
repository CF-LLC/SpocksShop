import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { ClosetForm } from "@/components/admin/closet-form";
import { centsToDollars } from "@/lib/commerce/money";
import { db } from "@/lib/db";
import { categories, inventory, photos, products } from "@/lib/db/schema";
import { MAX_PHOTOS, mediaUrl } from "@/lib/media";

export default async function EditClosetItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: NoticeParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ p: products, inv: inventory })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(eq(products.id, id), eq(products.source, "closet")));
  if (!row) notFound();
  const [cats, pics] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select().from(photos).where(eq(photos.productId, id)).orderBy(asc(photos.sortOrder), asc(photos.createdAt)),
  ]);
  const p = row.p;
  const money = (c: number | null) => (c == null ? null : centsToDollars(c));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <Link href={`/shop/${p.slug}`} className="btn btn-outline">View in shop</Link>
      </div>
      <AdminNotice {...await searchParams} />
      <ClosetForm
        action={`/api/admin/closet/${id}`}
        categories={cats}
        submitLabel="Save"
        values={{ ...p, price: centsToDollars(p.priceCents), originalPrice: money(p.originalPriceCents), purchaseCost: money(p.purchaseCostCents), quantity: row.inv?.quantityOnHand ?? 0 }}
      />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Photos</h2>
        {pics.length === 0 ? <p className="text-sm text-slate-500">No uploaded photos yet. The shop uses the catalog images until you add some.</p> : (
          <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pics.map((ph, i) => (
              <li key={ph.id} className="rounded-xl border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(ph.storagePath)} alt={ph.alt} className="aspect-square w-full rounded-lg object-cover" />
                <div className="mt-2 flex gap-2 text-xs">
                  <form action={`/api/admin/photos/${ph.id}`} method="post"><input type="hidden" name="intent" value="up" /><button className="btn-text" disabled={i === 0}>↑</button></form>
                  <form action={`/api/admin/photos/${ph.id}`} method="post"><input type="hidden" name="intent" value="down" /><button className="btn-text" disabled={i === pics.length - 1}>↓</button></form>
                  <form action={`/api/admin/photos/${ph.id}`} method="post" className="ml-auto"><input type="hidden" name="intent" value="delete" /><button className="btn-text text-red-700">Delete</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form action={`/api/admin/closet/${id}/photos`} method="post" encType="multipart/form-data" className="flex flex-wrap items-center gap-3">
          <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required className="text-sm" />
          <button type="submit" className="btn btn-outline">Upload (up to {MAX_PHOTOS})</button>
        </form>
      </div>

      <form action={`/api/admin/closet/${id}`} method="post" className="border-t pt-4">
        <input type="hidden" name="intent" value="delete" />
        <button type="submit" className="btn btn-outline text-red-700">Delete item</button>
        <span className="ml-3 text-xs text-slate-500">Removes the item, its inventory row and its uploaded photos. Order history keeps its snapshots.</span>
      </form>
    </section>
  );
}
