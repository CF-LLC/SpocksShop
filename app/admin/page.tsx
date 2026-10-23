import Link from "next/link";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventory, orders, productImports, products, taxRates } from "@/lib/db/schema";
import { AWAITING } from "@/lib/approval/core";
import { TAX_DFA_BANNER } from "@/lib/commerce/tax";
import { stripeSettings } from "@/lib/stripe";

export default async function AdminDashboardPage() {
  const [productCount] = await db.select({ value: count() }).from(products);
  const [orderCount] = await db.select({ value: count() }).from(orders);
  const [stock] = await db.select({ value: count() }).from(inventory);
  const unverified = await db.select().from(taxRates);
  const byStatus = await db.select({ status: products.status, n: count() }).from(products).where(eq(products.source, "closet")).groupBy(products.status);
  const c = (s: string) => byStatus.find((r) => r.status === s)?.n ?? 0;
  const [awaiting] = await db.select({ value: count() }).from(orders).where(eq(orders.status, AWAITING));
  const [recentImports] = await db.select({ value: count() }).from(productImports).where(gte(productImports.importedAt, sql`now() - interval '7 days'`));
  const [noPhoto] = await db.select({ value: count() }).from(products).where(and(eq(products.source, "closet"), eq(products.status, "draft"), sql`not exists (select 1 from photos ph where ph.product_id = ${products.id})`));
  const tiles: [string, number, string, string?][] = [
    ["Live closet picks", c("listed"), "/admin/closet?status=listed"],
    ["Drafts to review", c("draft"), "/admin/closet?status=draft", c("draft") ? "amber" : undefined],
    ["Drafts without photos", noPhoto.value, "/admin/closet?status=draft"],
    ["Orders awaiting approval", awaiting.value, "/admin/orders", awaiting.value ? "amber" : undefined],
    ["Sold", c("sold"), "/admin/closet?status=sold"],
    ["Archived", c("archived"), "/admin/closet?status=archived"],
    ["In Trash", c("trashed"), "/admin/closet?view=trash"],
    ["Depop imports (7 days)", recentImports.value, "/admin/closet?source=depop&sort=newest"],
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/closet/new" className="btn btn-primary">＋ Add item</Link>
          <Link href="/admin/closet/import" className="btn btn-outline">Import from Depop</Link>
          <Link href="/admin/closet?status=draft" className="btn btn-outline">Review drafts</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="dashboard-overview">
        {tiles.map(([label, n, href, tone]) => (
          <Link key={label} href={href} className={`rounded-xl border bg-white p-3 hover:border-slate-900 ${tone === "amber" ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-semibold">{n}</p>
          </Link>
        ))}
      </div>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        {TAX_DFA_BANNER}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border p-4">
          <p className="text-sm text-slate-500">Products</p>
          <p className="text-2xl font-semibold">{productCount.value}</p>
        </article>
        <article className="rounded-xl border p-4">
          <p className="text-sm text-slate-500">Inventory rows</p>
          <p className="text-2xl font-semibold">{stock.value}</p>
        </article>
        <article className="rounded-xl border p-4">
          <p className="text-sm text-slate-500">Orders</p>
          <p className="text-2xl font-semibold">{orderCount.value}</p>
        </article>
      </div>
      <p className="text-sm text-slate-600">
        Unverified tax rows: {unverified.filter((row) => !row.verifiedWithAuthority).length}. {stripeSettings().checkoutEnabled ? "Stripe Checkout is on; tax is not collected." : "Checkout is off until STRIPE_CHECKOUT_ENABLED=true and a Stripe secret key are set (shop shows \"Checkout coming soon\")."}
      </p>
    </section>
  );
}
