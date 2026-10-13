"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/contexts/cart-context";
import { PRIMARY_NAV, isActive } from "@/lib/nav";
import { CartIcon } from "@/components/ui/icons";

export function Brand() {
  return (
    <Link href="/" className="flex min-h-[44px] items-center gap-2.5 font-display text-lg font-bold tracking-tight" aria-label="Spock's Resale Shop, home">
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--space-1,#0a1022)] text-xl leading-none shadow-[inset_0_0_10px_rgba(201,179,255,.18)]">🖖</span>
      <span>
        Spock&apos;s <span className="text-[var(--gold-strong)]">Resale Shop</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const cart = useCart();
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--space-0)_88%,transparent)] backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Brand />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
              className="inline-flex min-h-[44px] items-center rounded-full px-4 font-semibold text-[var(--text-muted)] hover:text-[var(--text)] aria-[current=page]:text-[var(--gold-strong)]"
            >
              {l.label}
            </Link>
          ))}
          <button type="button" onClick={cart.open} className="btn btn-outline ml-3" aria-label={`Open cart, ${cart.count} item${cart.count === 1 ? "" : "s"}`}>
            <span className="relative mr-2">
              <CartIcon className="h-5 w-5" />
              {cart.count > 0 ? <span className="badge">{cart.count}</span> : null}
            </span>
            Cart
          </button>
        </nav>
      </div>
    </header>
  );
}
