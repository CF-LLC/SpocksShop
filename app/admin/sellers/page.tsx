import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { db } from "@/lib/db";
import { communityListings, sellerPayouts, sellers } from "@/lib/db/schema";
import { communitySellersEnabled } from "@/lib/features";
import { formatCents } from "@/lib/commerce/money";

export const dynamic = "force-dynamic";

const CONNECT: Record<string, string> = { not_started: "not started", pending: "onboarding", restricted: "needs info", active: "ready", rejected: "rejected" };

export default async function AdminSellersPage({ searchParams }: { searchParams: NoticeParams }) {
  const rows = await db
    .select({ s: sellers, listings: count(communityListings.id) })
    .from(sellers)
    .leftJoin(communityListings, eq(communityListings.sellerId, sellers.id))
    .groupBy(sellers.id)
    .orderBy(desc(sellers.createdAt));
  const money = await db
    .select({
      sellerId: sellerPayouts.sellerId,
      fees: sql<number>`coalesce(sum(${sellerPayouts.feeCents}) filter (where ${sellerPayouts.status} <> 'canceled'), 0)::int`,
      held: sql<number>`coalesce(sum(${sellerPayouts.amountCents}) filter (where ${sellerPayouts.status} in ('held','disputed')), 0)::int`,
      paid: sql<number>`coalesce(sum(${sellerPayouts.amountCents}) filter (where ${sellerPayouts.status} = 'transferred'), 0)::int`,
    })
    .from(sellerPayouts)
    .groupBy(sellerPayouts.sellerId);
  const by = new Map(money.map((m) => [m.sellerId, m]));
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sellers</h1>
        <Link className="btn btn-outline" href="/admin/sellers/payouts">Fees &amp; held payouts →</Link>
      </div>
      {!communitySellersEnabled() ? <p className="text-sm text-amber-800">Seller marketplace is off (COMMUNITY_SELLERS_ENABLED).</p> : null}
      <AdminNotice {...await searchParams} />
      <p className="text-xs text-slate-600">A seller can list and sell only when Status is active <em>and</em> Stripe is ready (transfers capability active).</p>
      {rows.length === 0 ? <p className="text-sm text-slate-500">No sellers yet.</p> : (
        <table className="min-w-full text-left text-sm">
          <thead><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Status</th><th className="p-2">Stripe</th><th className="p-2">Listings</th><th className="p-2">Fees earned</th><th className="p-2">Held</th><th className="p-2">Paid out</th><th className="p-2">Joined</th><th className="p-2" /></tr></thead>
          <tbody>
            {rows.map(({ s, listings }) => {
              const m = by.get(s.id);
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{s.displayName}</td>
                  <td className="p-2">{s.email}</td>
                  <td className="p-2">{s.status}</td>
                  <td className="p-2">{CONNECT[s.connectStatus] ?? s.connectStatus}{s.requirementsDue ? ` (${s.requirementsDue} due)` : ""}</td>
                  <td className="p-2">{listings}</td>
                  <td className="p-2">{formatCents(m?.fees ?? 0)}</td>
                  <td className="p-2">{formatCents(m?.held ?? 0)}</td>
                  <td className="p-2">{formatCents(m?.paid ?? 0)}</td>
                  <td className="p-2">{s.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="p-2">
                    <form action={`/api/admin/sellers/${s.id}`} method="post" className="flex gap-2">
                      {s.status !== "active" ? <button name="intent" value="activate" className="btn btn-outline">Approve</button> : null}
                      {s.status !== "suspended" ? <button name="intent" value="suspend" className="btn-text text-red-700">Suspend</button> : null}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
