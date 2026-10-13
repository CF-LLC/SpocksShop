import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventory, orders, products, taxRates } from "@/lib/db/schema";
import { TAX_DFA_BANNER } from "@/lib/commerce/tax";
import { stripeSettings } from "@/lib/stripe";

export default async function AdminDashboardPage() {
  const [productCount] = await db.select({ value: count() }).from(products);
  const [orderCount] = await db.select({ value: count() }).from(orders);
  const [stock] = await db.select({ value: count() }).from(inventory);
  const unverified = await db.select().from(taxRates);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
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
