"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/contexts/cart-context";
import { formatCents } from "@/lib/commerce/money";
import { BUNDLE_PRICE_CENTS, BUNDLE_SIZES, type BundleSize } from "@/lib/shop/closet-bundle";

export type BundleSizeOption = {
  size: BundleSize;
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  available: number;
  image: string | null;
};

type Props = {
  sizes: BundleSizeOption[];
  initialSize: BundleSize | null;
  checkoutEnabled: boolean;
};

/** Size selector plus add-to-cart / buy-now, using the existing Closet cart and checkout. */
export function ClosetBundleBuyBox({ sizes, initialSize, checkoutEnabled }: Props) {
  const cart = useCart();
  const firstAvailable = sizes.find((s) => s.available > 0)?.size ?? sizes[0]?.size ?? "M";
  const [size, setSize] = useState<BundleSize>(initialSize && sizes.some((s) => s.size === initialSize) ? initialSize : firstAvailable);
  const selected = useMemo(() => sizes.find((s) => s.size === size), [sizes, size]);
  if (!selected) return <p className="notice">The bundle box isn&apos;t available right now.</p>;

  const inCart = cart.lines.some((l) => l.productId === selected.id);
  const soldOut = selected.available <= 0;
  const snapshot = { id: selected.id, slug: selected.slug, title: selected.title, priceCents: selected.priceCents, image: selected.image };

  const add = () => (inCart ? cart.open() : cart.add(snapshot, selected.available));

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="field-label mb-2">Size</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Bundle box size">
          {BUNDLE_SIZES.map((option) => {
            const row = sizes.find((s) => s.size === option.size);
            const unavailable = !row || row.available <= 0;
            const pressed = option.size === size;
            return (
              <button
                key={option.size}
                type="button"
                className={`btn ${pressed ? "btn-primary" : "btn-outline"}`}
                aria-pressed={pressed}
                disabled={unavailable}
                onClick={() => row && setSize(option.size)}
              >
                {option.label}
                {unavailable ? " · sold out" : ""}
              </button>
            );
          })}
        </div>
      </fieldset>

      {soldOut ? (
        <p className="notice">Size {selected.size} is packed out right now. Pick another size, or check back after I restock.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={add} className="btn btn-primary sm:min-w-48">
              {inCart ? "In your cart: view cart" : `Add size ${selected.size} to cart`}
            </button>
            {checkoutEnabled ? (
              <a
                href="/checkout"
                onClick={() => {
                  if (!inCart) cart.add(snapshot, selected.available);
                  cart.close();
                }}
                className="btn btn-outline sm:min-w-40"
              >
                Buy now · {formatCents(selected.priceCents || BUNDLE_PRICE_CENTS)}
              </a>
            ) : (
              <button type="button" className="btn btn-outline" disabled aria-disabled="true">
                Checkout coming soon
              </button>
            )}
          </div>
          {!checkoutEnabled ? <p className="dim text-sm">Online payment opens soon. You can still add this to your cart.</p> : null}
        </>
      )}
    </div>
  );
}
