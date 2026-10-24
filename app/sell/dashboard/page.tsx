import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FormError } from "@/components/shop/form-error";
import { getSellerSession } from "@/lib/auth/seller-session";
import { formatCents } from "@/lib/commerce/money";
import { db } from "@/lib/db";
import { communityListings, orders, sellerPayouts, sellers } from "@/lib/db/schema";
import { sellerBlockReason, sellerCanSell } from "@/lib/marketplace/core";
import { marketplaceSettings } from "@/lib/marketplace/config";
import { MAX_PHOTOS } from "@/lib/media";
import { productConditions } from "@/lib/types";
import { ShipFromForm } from "@/components/shipping/ship-from-form";
import { getShipFrom } from "@/lib/shipping/ship-from";

export default async function SellerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string; connect?: string }>;
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
  const { error, submitted, connect } = await searchParams;
  const sales = await db
    .select({ o: orders, p: sellerPayouts })
    .from(orders)
    .leftJoin(sellerPayouts, eq(sellerPayouts.orderId, orders.id))
    .where(eq(orders.sellerId, seller.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  const canSell = sellerCanSell(seller);
  const blocked = sellerBlockReason(seller);
  const { feeBps, holdDaysAfterDelivery } = marketplaceSettings();
  const pct = (feeBps / 100).toFixed(feeBps % 100 ? 2 : 0);
  const shipFrom = await getShipFrom(db, { sellerId: seller.id });

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

      <section className="surface-panel space-y-3 rounded-2xl p-5" data-testid="payouts-setup">
        <h2 className="text-lg font-semibold">Payouts</h2>
        <p className="text-sm">Stripe setup: <strong>{({ not_started: "Not started", pending: "In progress", restricted: "Needs more information", active: "Ready", rejected: "Not approved by Stripe" } as Record<string, string>)[seller.connectStatus] ?? seller.connectStatus}</strong>
          {seller.requirementsDue > 0 ? <> · {seller.requirementsDue} item(s) due</> : null}</p>
        {connect === "returned" && !seller.transfersActive ? <p className="text-sm text-amber-800">Thanks. Stripe is still reviewing or needs a few more details. This page updates automatically.</p> : null}
        <p className="text-sm text-slate-600">We charge buyers, then send your share by Stripe transfer {holdDaysAfterDelivery} day(s) after the package is delivered. Spock&apos;s Shop keeps a {pct}% fee on your item price; shipping and sales tax are handled by Spock&apos;s Shop.</p>
        <div className="flex flex-wrap gap-2">
          {seller.status !== "suspended" && !seller.transfersActive ? (
            <form action="/api/sell/connect/onboard" method="post"><button className="btn btn-primary" type="submit">{seller.stripeAccountId ? "Continue Stripe setup" : "Set up payouts with Stripe"}</button></form>
          ) : null}
          {seller.stripeAccountId && seller.transfersActive ? (
            <form action="/api/sell/connect/dashboard" method="post"><button className="btn btn-outline" type="submit">Open Stripe Express dashboard</button></form>
          ) : null}
        </div>
      </section>

      {canSell ? (
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
      ) : seller.status === "active" ? (
        <p className="surface-panel rounded-2xl p-5 text-sm">{blocked}</p>
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
      <div>
        <h2 className="mb-2 text-lg font-semibold">Your orders</h2>
        {sales.length === 0 ? <p className="text-sm text-slate-500">No sales yet.</p> : (
          <table className="min-w-full text-left text-sm">
            <thead><tr><th className="p-2">Order</th><th className="p-2">Status</th><th className="p-2">Items</th><th className="p-2">Fee</th><th className="p-2">Your payout</th><th className="p-2">Payout status</th></tr></thead>
            <tbody>
              {sales.map(({ o, p }) => (
                <tr key={o.id} className="border-t">
                  <td className="p-2">{o.orderNumber}</td>
                  <td className="p-2">{o.deliveredAt ? "delivered" : o.shippedAt ? "shipped" : o.status}</td>
                  <td className="p-2">{formatCents(o.subtotalCents)}</td>
                  <td className="p-2">{p ? formatCents(p.feeCents) : "–"}</td>
                  <td className="p-2">{p ? formatCents(p.amountCents) : "–"}</td>
                  <td className="p-2">{!p ? "awaiting payment" : p.status === "held" ? (p.releaseAfter ? `held until ${p.releaseAfter.toISOString().slice(0, 10)}` : "held until delivery") : p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h2 className="font-semibold">Your return address</h2>
        <ShipFromForm action="/api/sell/ship-from" saved={shipFrom} />
      </section>
    </section>
  );
}
