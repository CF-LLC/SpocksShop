import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { ClosetForm } from "@/components/admin/closet-form";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { centsToDollars, formatCents } from "@/lib/commerce/money";
import { db } from "@/lib/db";
import { categories, inventory, photos, productImports, products } from "@/lib/db/schema";
import { MAX_PHOTOS_PER_PRODUCT, mediaUrl } from "@/lib/media";

export default async function EditClosetItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: NoticeParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ p: products, inv: inventory })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(eq(products.id, id), eq(products.source, "closet")));
  if (!row) notFound();
  const [cats, pics, imported] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select().from(photos).where(eq(photos.productId, id)).orderBy(asc(photos.sortOrder), asc(photos.createdAt)),
    // Admin-only: where a Depop-imported draft came from. Never rendered on public pages.
    db.select({ url: productImports.sourceUrl }).from(productImports).where(eq(productImports.productId, id)).limit(1),
  ]);
  const p = row.p;
  const money = (c: number | null) => (c == null ? null : centsToDollars(c));
  const live = p.status === "listed";
  const canToggle = p.status === "listed" || p.status === "draft";
  const reserved = row.inv?.quantityReserved ?? 0;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link href="/admin/closet" className="inline-flex min-h-[44px] items-center text-sm text-slate-600">← All closet items</Link>
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${live ? "bg-emerald-100 text-emerald-900" : p.status === "pending_approval" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-800"}`}>{live ? "Live in shop" : p.status === "draft" ? "Draft (hidden)" : p.status === "pending_approval" ? "Pending approval (held)" : p.status}</span>
          {p.status === "pending_approval" ? <Link href="/admin/orders" className="text-sm font-semibold text-amber-800 underline" data-testid="pending-link">Waiting for your decision in Orders →</Link> : null}
          <span className="text-sm text-slate-600">{formatCents(p.priceCents)} · qty {row.inv?.quantityOnHand ?? 0}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {canToggle ? (
            <form action={`/api/admin/closet/${id}`} method="post">
              <input type="hidden" name="intent" value={live ? "unpublish" : "publish"} />
              <button type="submit" className={`btn w-full ${live ? "btn-outline" : "btn-primary"}`} data-testid="publish-toggle">{live ? "Unpublish" : "Publish"}</button>
            </form>
          ) : <span />}
          <Link href={`/shop/${p.slug}`} className="btn btn-outline w-full">View in shop</Link>
        </div>
      </div>
      {imported[0] ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" data-testid="depop-origin">
          Imported from Depop (admin only, never shown to shoppers): <span className="break-all">{imported[0].url}</span>. Check the title, price, condition and photos, then Publish.
        </p>
      ) : null}
      <AdminNotice {...await searchParams} />

      <section id="photos" aria-labelledby="photos-title" className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <h2 id="photos-title" className="text-lg font-semibold">Photos <span className="text-sm font-normal text-slate-600">({pics.length}/{MAX_PHOTOS_PER_PRODUCT})</span></h2>
        {pics.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pics.map((ph, i) => (
              <li key={ph.id} className="rounded-xl border border-slate-200 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(ph.storagePath)} alt={ph.alt} className="checker aspect-square w-full rounded-lg object-contain" />
                {i === 0 ? <p className="mt-1 text-center text-xs font-semibold text-amber-800">Cover photo</p> : null}
                <div className="mt-1 grid grid-cols-3 gap-1">
                  <form action={`/api/admin/photos/${ph.id}`} method="post"><input type="hidden" name="intent" value="up" /><button className="btn btn-outline w-full px-0" disabled={i === 0} aria-label="Move earlier">↑</button></form>
                  <form action={`/api/admin/photos/${ph.id}`} method="post"><input type="hidden" name="intent" value="down" /><button className="btn btn-outline w-full px-0" disabled={i === pics.length - 1} aria-label="Move later">↓</button></form>
                  <form action={`/api/admin/photos/${ph.id}`} method="post"><input type="hidden" name="intent" value="delete" /><button className="btn btn-outline w-full px-0 text-red-700" aria-label="Delete photo">🗑</button></form>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-600">No photos yet. The first photo becomes the cover.</p>}
        <PhotoUploader productId={id} remaining={MAX_PHOTOS_PER_PRODUCT - pics.length} alt={p.title} />
      </section>

      <section aria-labelledby="details-title" className="space-y-3">
        <h2 id="details-title" className="text-lg font-semibold">Details &amp; price</h2>
        <ClosetForm
          action={`/api/admin/closet/${id}`}
          categories={cats}
          submitLabel="Save changes"
          values={{ ...p, price: centsToDollars(p.priceCents), originalPrice: money(p.originalPriceCents), purchaseCost: money(p.purchaseCostCents), quantity: row.inv?.quantityOnHand ?? 0 }}
        />
      </section>

      <section aria-labelledby="danger-title" className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <h2 id="danger-title" className="font-semibold text-red-900">Delete item</h2>
        {reserved > 0 ? (
          <p className="mt-1 text-sm text-red-900">This item is in an open checkout, so it can&apos;t be deleted right now.</p>
        ) : (
          <details className="mt-2" data-testid="delete-confirm">
            <summary className="btn btn-outline cursor-pointer list-none text-red-700">Delete…</summary>
            <form action={`/api/admin/closet/${id}`} method="post" className="mt-3 space-y-3">
              <input type="hidden" name="intent" value="delete" />
              <p className="text-sm text-red-900">
                Permanently delete <strong>{p.title}</strong>, its inventory and {pics.length} photo{pics.length === 1 ? "" : "s"}? Past orders keep their own copy of the title and price. This can&apos;t be undone. Tip: <em>Unpublish</em> hides it without deleting.
              </p>
              <label className="flex min-h-[44px] items-center gap-3 text-sm text-red-900">
                <input type="checkbox" name="confirm" value="delete" required className="h-5 w-5" /> Yes, delete this item
              </label>
              <button type="submit" className="btn w-full border-red-700 bg-red-700 text-white">Delete permanently</button>
            </form>
          </details>
        )}
      </section>
    </section>
  );
}
