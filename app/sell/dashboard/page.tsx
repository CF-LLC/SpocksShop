import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FormError } from "@/components/shop/form-error";
import { getSellerSession } from "@/lib/auth/seller-session";
import { formatCents } from "@/lib/commerce/money";
import { db } from "@/lib/db";
import { communityListings, sellers } from "@/lib/db/schema";
import { MAX_PHOTOS } from "@/lib/media";
import { productConditions } from "@/lib/types";

export default async function SellerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const session = await getSellerSession();
  if (!session) redirect("/sell/login");
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, session.sellerId));
  if (!seller) redirect("/sell/login");
  const listings = await db
    .select()
    .from(communityListings)
    .where(eq(communityListings.sellerId, seller.id))
    .orderBy(desc(communityListings.createdAt));
  const { error, submitted } = await searchParams;

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hi, {seller.displayName}</h1>
          <p className="text-sm text-slate-600">Account status: <strong>{seller.status}</strong></p>
        </div>
        <form action="/api/sell/logout" method="post"><button className="btn btn-outline" type="submit">Sign out</button></form>
      </header>

      <FormError message={error} />
      {submitted ? <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">Submitted. Your listing is pending review.</p> : null}

      {seller.status === "active" ? (
        <form action="/api/sell/listings" method="post" encType="multipart/form-data" className="surface-panel space-y-4 rounded-2xl p-5">
          <h2 className="text-lg font-semibold">Submit a listing</h2>
          <label className="block text-sm">Title<input name="title" required minLength={3} maxLength={120} className="field-input mt-1 w-full" /></label>
          <label className="block text-sm">Description<textarea name="description" rows={4} maxLength={4000} className="field-input mt-1 w-full" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">Condition
              <select name="condition" className="field-input mt-1 w-full" defaultValue="Good">
                {productConditions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block text-sm">Price (USD)<input name="price" type="number" min="0.01" step="0.01" required className="field-input mt-1 w-full" /></label>
          </div>
          <label className="block text-sm">Photos (JPEG, PNG or WebP, up to {MAX_PHOTOS}, 5 MB each)
            <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required className="mt-1 block w-full text-sm" />
          </label>
          <button type="submit" className="btn btn-primary">Submit for review</button>
        </form>
      ) : seller.status === "pending" ? (
        <p className="surface-panel rounded-2xl p-5 text-sm">Your seller account is waiting for approval. You can submit listings once it&apos;s active.</p>
      ) : (
        <p className="surface-panel rounded-2xl p-5 text-sm">Your seller account is suspended. Contact support@spockshop.com.</p>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Your listings</h2>
        {listings.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
          <table className="min-w-full text-left text-sm">
            <thead><tr><th className="p-2">Title</th><th className="p-2">Price</th><th className="p-2">Status</th><th className="p-2">Note</th></tr></thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">{l.title}</td>
                  <td className="p-2">{formatCents(l.priceCents)}</td>
                  <td className="p-2">{l.status}</td>
                  <td className="p-2 text-slate-600">{l.moderationNote ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
