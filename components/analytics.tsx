"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type Name = "page_view" | "product_view" | "add_to_cart" | "checkout_start" | "amazon_click";

/** Fire-and-forget first-party event. No cookies, no ids; never blocks rendering. */
export function track(name: Name, ref?: string, extra?: { referrer?: string }) {
  try {
    if (window.location.pathname.startsWith("/admin")) return;
    const body = JSON.stringify({ name, path: window.location.pathname, host: window.location.hostname, ref, ...extra });
    if (!navigator.sendBeacon?.("/api/track", body)) fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {}
}

/** Counts page views, product views and Amazon pick clicks site-wide (not rendered for admins). */
export function EventTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    // After paint, so it never delays the page; skip 404 pages (incl. held designs).
    const t = setTimeout(() => {
      if (document.querySelector("[data-not-found]")) return;
      const referrer = first.current ? document.referrer : undefined;
      first.current = false;
      track("page_view", undefined, referrer ? { referrer } : undefined);
      if (/^\/shop\/[^/]+$/.test(pathname) || (/^\/drop\/[^/]+$/.test(pathname) && pathname !== "/drop/success")) track("product_view");
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (window.location.pathname.startsWith("/admin")) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let u: URL;
      try { u = new URL(a.href); } catch { return; }
      if (!/(^|\.)amazon\.[a-z.]+$|(^|\.)amzn\.to$/.test(u.hostname)) return;
      const asin = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
      track("amazon_click", asin ?? "link");
    };
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("auxclick", onClick, { capture: true });
    return () => { document.removeEventListener("click", onClick, { capture: true }); document.removeEventListener("auxclick", onClick, { capture: true }); };
  }, []);
  return null;
}
