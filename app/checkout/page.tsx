import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { db } from "@/lib/db";
import { shippingRates } from "@/lib/db/schema";
import { stripeSettings } from "@/lib/stripe";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

async function rates() {
  try {
    return await db.select({ name: shippingRates.name, amountCents: shippingRates.amountCents }).from(shippingRates).where(eq(shippingRates.isActive, true)).orderBy(asc(shippingRates.amountCents));
  } catch {
    return [];
  }
}

export default async function CheckoutPage() {
  const settings = stripeSettings();
  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumbs items={[{ href: "/shop", label: "Shop" }, { label: "Checkout" }]} />
      <h1 className="t-h1 mb-6">Checkout</h1>
      <CheckoutForm checkoutEnabled={settings.checkoutEnabled} shippingRates={await rates()} />
    </div>
  );
}
