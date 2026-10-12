import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { formatCents } from "@/lib/commerce/money";
import { db } from "@/lib/db";
import { inventory, products } from "@/lib/db/schema";
import { SHOP_SECTIONS } from "@/lib/shop/sections";

export default async function AdminClosetPage({ searchParams }: { searchParams: NoticeParams }) {
  const rows = await db
    .select({ id: products.id, sku: products.sku, title: products.title, status: products.status, priceCents: products.priceCents, onHand: inventory.quantityOnHand })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(eq(products.source, "closet"))
    .orderBy(asc(products.title));
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{SHOP_SECTIONS.closet.title}</h1>
        <Link href="/admin/closet/new" className="btn btn-primary">New item</Link>
      </div>
      <AdminNotice {...await searchParams} />
      <table className="min-w-full text-left text-sm">
        <thead><tr><th className="p-2">SKU</th><th className="p-2">Title</th><th className="p-2">Status</th><th className="p-2">Price</th><th className="p-2">On hand</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-mono">{r.sku}</td>
              <td className="p-2"><Link className="text-blue-700 hover:underline" href={`/admin/closet/${r.id}`}>{r.title}</Link></td>
              <td className="p-2">{r.status}</td>
              <td className="p-2">{formatCents(r.priceCents)}</td>
              <td className="p-2">{r.onHand ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
