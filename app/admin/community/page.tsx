import { asc, desc, eq, inArray } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { formatCents } from "@/lib/commerce/money";
import { db } from "@/lib/db";
import { communityListings, photos, sellers } from "@/lib/db/schema";
import { mediaUrl } from "@/lib/media";
import { COMMUNITY_MARKET_NAME } from "@/lib/shop/sections";

export default async function AdminCommunityQueuePage({ searchParams }: { searchParams: NoticeParams }) {
  const pending = await db
    .select({ l: communityListings, seller: sellers.displayName, sellerStatus: sellers.status })
    .from(communityListings)
    .innerJoin(sellers, eq(sellers.id, communityListings.sellerId))
    .where(eq(communityListings.status, "pending"))
    .orderBy(asc(communityListings.createdAt));
  const recent = await db
    .select({ l: communityListings, seller: sellers.displayName })
    .from(communityListings)
    .innerJoin(sellers, eq(sellers.id, communityListings.sellerId))
    .where(inArray(communityListings.status, ["approved", "rejected"]))
    .orderBy(desc(communityListings.reviewedAt))
    .limit(20);
  const ids = pending.map((p) => p.l.id);
  const pics = ids.length ? await db.select().from(photos).where(inArray(photos.communityListingId, ids)).orderBy(asc(photos.sortOrder)) : [];

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">{COMMUNITY_MARKET_NAME}: approval queue</h1>
      <AdminNotice {...await searchParams} />
      {pending.length === 0 ? <p className="text-sm text-slate-500">Nothing waiting for review.</p> : (
        <ul className="space-y-4">
          {pending.map(({ l, seller, sellerStatus }) => (
            <li key={l.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{l.title}</h2>
                <p className="text-sm">{formatCents(l.priceCents)} · {l.condition ?? "—"} · by {seller} ({sellerStatus})</p>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{l.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pics.filter((p) => p.communityListingId === l.id).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={p.id} href={mediaUrl(p.storagePath)} target="_blank" rel="noopener"><img src={mediaUrl(p.storagePath)} alt={p.alt} className="h-24 w-24 rounded-lg object-cover" /></a>
                ))}
              </div>
              <form action={`/api/admin/community/${l.id}`} method="post" className="mt-3 flex flex-wrap items-center gap-2">
                <input name="note" placeholder="Note to seller (required to reject)" className="field-input min-w-64 flex-1" />
                <button type="submit" name="intent" value="approve" className="btn btn-primary" disabled={sellerStatus !== "active"} title={sellerStatus !== "active" ? "Activate the seller first" : undefined}>Approve &amp; publish</button>
                <button type="submit" name="intent" value="reject" className="btn btn-outline">Reject</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <div>
        <h2 className="mb-2 text-lg font-semibold">Recently reviewed</h2>
        <table className="min-w-full text-left text-sm">
          <thead><tr><th className="p-2">Title</th><th className="p-2">Seller</th><th className="p-2">Status</th><th className="p-2">Note</th></tr></thead>
          <tbody>
            {recent.map(({ l, seller }) => (
              <tr key={l.id} className="border-t"><td className="p-2">{l.title}</td><td className="p-2">{seller}</td><td className="p-2">{l.status}</td><td className="p-2 text-slate-600">{l.moderationNote ?? ""}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
