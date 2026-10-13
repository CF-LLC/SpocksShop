"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/contexts/cart-context";
import { isActive, PRIMARY_NAV, SHOP_TABS } from "@/lib/nav";
import { CartIcon, CloseIcon, HomeIcon, MenuIcon, ShopIcon } from "@/components/ui/icons";

/** Thumb-reach navigation for phones: Home, Shop, Cart, Menu. Hidden from md up. */
export function BottomNav({ sellersEnabled }: { sellersEnabled: boolean }) {
  const pathname = usePathname();
  const cart = useCart();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  return (
    <>
      <nav aria-label="Mobile" className="bottom-nav">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}><HomeIcon className="h-6 w-6" />Home</Link>
        <Link href="/shop" aria-current={isActive(pathname, "/shop") ? "page" : undefined}><ShopIcon className="h-6 w-6" />Shop</Link>
        <button type="button" onClick={cart.open} aria-label={`Cart, ${cart.count} item${cart.count === 1 ? "" : "s"}`}>
          <span className="relative"><CartIcon className="h-6 w-6" />{cart.count > 0 ? <span className="badge">{cart.count}</span> : null}</span>
          Cart
        </button>
        <button type="button" onClick={() => setMenu(true)} aria-expanded={menu} aria-controls="mobile-menu"><MenuIcon className="h-6 w-6" />Menu</button>
      </nav>
      {menu ? (
        <>
          <div className="overlay" onClick={() => setMenu(false)} aria-hidden />
          <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="sheet">
            <div className="mb-2 flex items-center justify-between">
              <p className="t-eyebrow">Menu</p>
              <button type="button" className="icon-btn" onClick={() => setMenu(false)} aria-label="Close menu"><CloseIcon className="h-6 w-6" /></button>
            </div>
            <ul className="grid gap-1" onClick={() => setMenu(false)}>
              {PRIMARY_NAV.map((l) => (
                <li key={l.href}><Link href={l.href} className="flex min-h-[48px] items-center rounded-xl px-3 text-lg font-semibold hover:bg-[var(--space-3)]">{l.label}</Link></li>
              ))}
            </ul>
            <p className="t-eyebrow mb-1 mt-5">Shop sections</p>
            <ul className="grid gap-1" onClick={() => setMenu(false)}>
              {SHOP_TABS.filter((t) => t.key !== "all").map((t) => (
                <li key={t.key}><Link href={t.href} className="muted flex min-h-[48px] items-center rounded-xl px-3 font-semibold hover:bg-[var(--space-3)]">{t.label}</Link></li>
              ))}
              {sellersEnabled ? <li><Link href="/sell/signup" className="muted flex min-h-[48px] items-center rounded-xl px-3 font-semibold hover:bg-[var(--space-3)]">Sell on Community Market</Link></li> : null}
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
