"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useCart } from "@/contexts/cart-context";
import { formatCents } from "@/lib/commerce/money";
import { CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";

export function CartDrawer() {
  const cart = useCart();
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { isOpen, close } = cart;

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  // Navigating away closes the drawer.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) close();
    lastPath.current = pathname;
  }, [pathname, close]);

  if (!isOpen) return null;
  const blocked = cart.lines.some((l) => cart.verified[l.productId] && !cart.verified[l.productId].purchasable);
  const empty = cart.lines.length === 0;

  return (
    <>
      <div className="overlay" onClick={close} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-labelledby="cart-title" className="drawer">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 id="cart-title" className="t-h3">Your cart {cart.count ? <span className="dim">({cart.count})</span> : null}</h2>
          <button ref={closeRef} type="button" onClick={close} className="icon-btn" aria-label="Close cart"><CloseIcon className="h-6 w-6" /></button>
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span aria-hidden className="text-4xl">🛸</span>
            <p className="t-h3">Your cart is empty</p>
            <p className="muted">Browse Closet Picks for one-of-a-kind finds, or see what we recommend on Amazon.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link href="/shop?tab=closet" className="btn btn-primary" onClick={close}>Shop Closet Picks</Link>
              <Link href="/shop?tab=amazon" className="btn btn-outline" onClick={close}>Amazon Picks</Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-[var(--line)] overflow-y-auto px-4">
              {cart.lines.map((line) => {
                const p = cart.products[line.productId];
                const v = cart.verified[line.productId];
                const max = v ? Math.max(1, v.available) : line.quantity;
                return (
                  <li key={line.productId} className="flex gap-3 py-4">
                    <div className="h-20 w-20 flex-none overflow-hidden rounded-xl bg-[#0d1428]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p?.image ?? "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/shop/${p?.slug ?? ""}`} className="line-clamp-2 font-semibold hover:underline" onClick={close}>{p?.title ?? "Item"}</Link>
                      <p className="price mt-1">{formatCents(p?.priceCents ?? 0)}</p>
                      {v && v.available === 0 ? <p className="mt-1 text-sm text-[var(--danger)]">Just sold out. Remove it to check out.</p> : null}
                      {v && v.available > 0 && !v.purchasable ? <p className="mt-1 text-sm text-[var(--warn)]">Checkout for this seller item isn&apos;t open yet.</p> : null}
                      <div className="mt-2 flex items-center gap-2">
                        {max > 1 ? (
                          <div className="flex items-center rounded-full border border-[var(--line-strong)]">
                            <button type="button" className="icon-btn" aria-label="Decrease quantity" onClick={() => cart.setQuantity(line.productId, line.quantity - 1)}><MinusIcon className="h-4 w-4" /></button>
                            <span className="w-6 text-center tabular-nums" aria-live="polite">{line.quantity}</span>
                            <button type="button" className="icon-btn" aria-label="Increase quantity" disabled={line.quantity >= max} onClick={() => cart.setQuantity(line.productId, Math.min(max, line.quantity + 1))}><PlusIcon className="h-4 w-4" /></button>
                          </div>
                        ) : <span className="dim text-sm">One of a kind</span>}
                        <button type="button" className="btn-text ml-auto text-sm" onClick={() => cart.remove(line.productId)}>Remove</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-[var(--line)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-baseline justify-between">
                <span className="muted">Subtotal</span>
                <span className="price text-xl">{formatCents(cart.subtotalCents)}</span>
              </div>
              <p className="dim mt-1 text-sm">Shipping or free Bentonville pickup is chosen at checkout. Sales tax isn&apos;t collected yet.</p>
              {cart.checkoutEnabled === false ? (
                <>
                  <button type="button" className="btn btn-primary btn-block mt-4" aria-disabled="true" disabled>Checkout coming soon</button>
                  <p className="dim mt-2 text-center text-sm">Online payment is almost ready. Questions about an item? <Link href="/contact" className="link" onClick={close}>Contact us</Link>.</p>
                </>
              ) : (
                <Link href="/checkout" onClick={close} aria-disabled={blocked || cart.checkoutEnabled === null} className={`btn btn-primary btn-block mt-4 ${blocked ? "pointer-events-none" : ""}`}>
                  {cart.checkoutEnabled === null ? "Checking…" : "Checkout"}
                </Link>
              )}
              <button type="button" onClick={close} className="btn btn-ghost btn-block mt-2">Keep shopping</button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
