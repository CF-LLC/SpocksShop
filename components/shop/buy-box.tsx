"use client";

import { useCart } from "@/contexts/cart-context";
import { formatCents } from "@/lib/commerce/money";

type Props = {
  product: { id: string; slug: string; title: string; priceCents: number; image: string | null; available: number };
  purchasable: boolean;
  checkoutEnabled: boolean;
  /** Why the item can't be bought (sold out, community not open yet). */
  reason?: string;
};

/** Add-to-cart + Buy now, plus a sticky version pinned above the mobile bottom nav. */
export function BuyBox({ product, purchasable, checkoutEnabled, reason }: Props) {
  const cart = useCart();
  const inCart = cart.lines.some((l) => l.productId === product.id);
  const snapshot = { id: product.id, slug: product.slug, title: product.title, priceCents: product.priceCents, image: product.image };

  const add = () => (inCart ? cart.open() : cart.add(snapshot, product.available));


  const addLabel = inCart ? "In your cart: view cart" : "Add to cart";

  if (!purchasable) {
    return <p className="notice">{reason ?? "This item isn't available right now."}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={add} className="btn btn-primary sm:min-w-48">{addLabel}</button>
        {checkoutEnabled ? (
          <a
            href="/checkout"
            onClick={() => {
              if (!inCart) cart.add(snapshot, product.available);
              cart.close();
            }}
            className="btn btn-outline sm:min-w-40"
          >
            Buy now
          </a>
        ) : (
          <button type="button" className="btn btn-outline" disabled aria-disabled="true">Checkout coming soon</button>
        )}
      </div>
      {!checkoutEnabled ? <p className="dim text-sm">Online payment opens soon. You can still add this to your cart.</p> : null}

      <div className="sticky-buy" role="region" aria-label="Purchase">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{product.title}</p>
            <p className="price">{formatCents(product.priceCents)}</p>
          </div>
          <button type="button" onClick={add} className="btn btn-primary">{inCart ? "View cart" : "Add to cart"}</button>
        </div>
      </div>
    </>
  );
}
