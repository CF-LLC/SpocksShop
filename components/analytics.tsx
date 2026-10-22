"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Fire-and-forget first-party event. No cookies, no ids. */
export function track(name: "product_view" | "amazon_click" | "checkout_start", ref?: string) {
  try {
    const body = JSON.stringify({ name, path: window.location.pathname, ref });
    if (!navigator.sendBeacon?.("/api/track", body)) fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {}
}

/** Counts product page views and Amazon pick clicks site-wide (skips admin pages). */
export function EventTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (/^\/shop\/[^/]+$/.test(pathname)) track("product_view");
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
