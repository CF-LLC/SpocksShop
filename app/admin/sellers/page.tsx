import { count, desc, eq } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { db } from "@/lib/db";
import { communityListings, sellers } from "@/lib/db/schema";
import { communitySellersEnabled } from "@/lib/features";

export default async function AdminSellersPage({ searchParams }: { searchParams: NoticeParams }) {
  const rows = await db
    .select({ s: sellers, listings: count(communityListings.id) })
    .from(sellers)
    .leftJoin(communityListings, eq(communityListings.sellerId, sellers.id))
    .groupBy(sellers.id)
    .orderBy(desc(sellers.createdAt));
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Sellers</h1>
      {!communitySellersEnabled() ? <p className="text-sm text-amber-800">Seller signup is off (COMMUNITY_SELLERS_ENABLED).</p> : null}
      <AdminNotice {...await searchParams} />
      {rows.length === 0 ? <p className="text-sm text-slate-500">No sellers yet.</p> : (
        <table className="min-w-full text-left text-sm">
          <thead><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Status</th><th className="p-2">Listings</th><th className="p-2">Joined</th><th className="p-2" /></tr></thead>
          <tbody>
            {rows.map(({ s, listings }) => (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.displayName}</td>
                <td className="p-2">{s.email}</td>
                <td className="p-2">{s.status}</td>
                <td className="p-2">{listings}</td>
                <td className="p-2">{s.createdAt.toISOString().slice(0, 10)}</td>
                <td className="p-2">
                  <form action={`/api/admin/sellers/${s.id}`} method="post" className="flex gap-2">
                    {s.status !== "active" ? <button name="intent" value="activate" className="btn btn-outline">Activate</button> : null}
                    {s.status !== "suspended" ? <button name="intent" value="suspend" className="btn-text text-red-700">Suspend</button> : null}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
