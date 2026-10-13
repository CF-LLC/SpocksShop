"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/contexts/cart-context";
import { formatCents } from "@/lib/commerce/money";
import { EmptyState } from "@/components/ui/empty-state";

export function CheckoutForm({ checkoutEnabled, shippingRates }: { checkoutEnabled: boolean; shippingRates: { name: string; amountCents: number }[] }) {
  const cart = useCart();
  const [method, setMethod] = useState<"pickup" | "ship">("pickup");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon="🛸"
        title="Your cart is empty"
        body="Add something from Spock's Closet to check out."
        actions={[{ href: "/shop?tab=closet", label: "Shop Spock's Closet" }, { href: "/shop?tab=amazon", label: "Amazon Picks" }]}
      />
    );
  }

  const unavailable = cart.lines.filter((l) => cart.verified[l.productId] && !cart.verified[l.productId].purchasable);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: cart.lines, method }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Checkout failed. Nothing was charged.");
      void cart.refresh();
    } catch {
      setError("Network problem. Nothing was charged; please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section className="panel p-5" aria-labelledby="review-title">
        <h2 id="review-title" className="t-h3 mb-3">Review items</h2>
        <ul className="divide-y divide-[var(--line)]">
          {cart.lines.map((l) => {
            const p = cart.products[l.productId];
            const v = cart.verified[l.productId];
            return (
              <li key={l.productId} className="flex items-center gap-3 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p?.image ?? "/placeholder.svg"} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <Link href={`/shop/${p?.slug ?? ""}`} className="line-clamp-1 font-semibold hover:underline">{p?.title}</Link>
                  <p className="dim text-sm">Qty {l.quantity}{v && !v.purchasable ? " · not available for checkout" : ""}</p>
                </div>
                <span className="price">{formatCents((p?.priceCents ?? 0) * l.quantity)}</span>
              </li>
            );
          })}
        </ul>

        <fieldset className="mt-6">
          <legend className="t-h3 mb-3">How do you want it?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`panel flex min-h-[44px] cursor-pointer gap-3 p-4 ${method === "pickup" ? "border-[var(--gold)]" : ""}`}>
              <input type="radio" name="method" value="pickup" checked={method === "pickup"} onChange={() => setMethod("pickup")} className="mt-1 h-5 w-5 accent-[var(--gold)]" />
              <span><span className="block font-semibold">Local pickup · Free</span><span className="muted text-sm">Bentonville, AR. We&apos;ll email to set a time.</span></span>
            </label>
            <label className={`panel flex min-h-[44px] cursor-pointer gap-3 p-4 ${method === "ship" ? "border-[var(--gold)]" : ""}`}>
              <input type="radio" name="method" value="ship" checked={method === "ship"} onChange={() => setMethod("ship")} className="mt-1 h-5 w-5 accent-[var(--gold)]" />
              <span><span className="block font-semibold">Ship to me (US)</span><span className="muted text-sm">{shippingRates.length ? `By weight: ${shippingRates.map((r) => `${r.name} ${formatCents(r.amountCents)}`).join(", ")}.` : "Rate by weight, shown on the payment page."}</span></span>
            </label>
          </div>
        </fieldset>
      </section>

      <aside className="panel h-fit p-5" aria-labelledby="summary-title">
        <h2 id="summary-title" className="t-h3 mb-3">Summary</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between"><dt className="muted">Items</dt><dd>{formatCents(cart.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt className="muted">{method === "pickup" ? "Pickup" : "Shipping"}</dt><dd>{method === "pickup" ? "Free" : "Calculated next"}</dd></div>
          <div className="flex justify-between"><dt className="muted">Sales tax</dt><dd>Not collected</dd></div>
        </dl>
        {checkoutEnabled ? (
          <>
            <button type="button" onClick={pay} disabled={busy || unavailable.length > 0} className="btn btn-primary btn-block mt-5">
              {busy ? "Opening secure checkout…" : "Pay securely with Stripe"}
            </button>
            <p className="dim mt-2 text-center text-xs">You&apos;ll enter payment details on Stripe. Items are held for you for 30 minutes.</p>
          </>
        ) : (
          <div className="mt-5" data-testid="checkout-coming-soon">
            <button type="button" className="btn btn-primary btn-block" disabled aria-disabled="true">Checkout coming soon</button>
            <p className="muted mt-3 text-sm">Online payment is almost ready. Your cart is saved on this device. Want an item now? <Link className="link" href="/contact">Contact us</Link> to arrange pickup.</p>
          </div>
        )}
        {unavailable.length ? <p className="mt-3 text-sm text-[var(--warn)]">Remove items marked not available to continue.</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
        <Link href="/shop" className="btn btn-ghost btn-block mt-2">Keep shopping</Link>
      </aside>
    </div>
  );
}
