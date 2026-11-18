"use client";

import Link from "next/link";
import { cartBundleNudge } from "@/lib/commerce/cart-nudge";
import { formatCents } from "@/lib/commerce/money";
import { useCart } from "@/contexts/cart-context";

/** Closet-only cart prompt when live shipping is high vs the item total. */
export function CartBundleNudge({ onNavigate }: { onNavigate?: () => void }) {
  const cart = useCart();
  const lines = cart.lines.flatMap((l) => {
    const p = cart.verified[l.productId];
    if (!p) return [];
    return [{ source: p.source, priceCents: p.priceCents, quantity: l.quantity, weightLb: p.weightLb, sku: p.sku }];
  });
  // Wait until every line has a verified weight/price from /api/cart.
  if (lines.length !== cart.lines.length) return null;
  const nudge = cartBundleNudge({ lines, rates: cart.shippingRates });
  if (!nudge.show) return null;

  return (
    <div data-testid="cart-bundle-nudge" className="rounded-xl border border-[var(--gold,#c9a227)] bg-[var(--panel,#fffbeb)] px-3 py-3 text-sm">
      <p className="font-semibold">{nudge.headline}</p>
      <p className="muted mt-1">{nudge.shippingLine} The Closet Bundle Box is {formatCents(nudge.bundlePriceCents)} for five tops, with one shipping fee from the same weight table.</p>
      {nudge.addMoreLine ? <p className="muted mt-1">{nudge.addMoreLine}</p> : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Link href={nudge.bundleHref} className="link font-semibold" onClick={onNavigate}>
          See the Closet Bundle Box
        </Link>
        <Link href="/shop?tab=closet" className="link" onClick={onNavigate}>
          Add more Closet items
        </Link>
      </div>
    </div>
  );
}
