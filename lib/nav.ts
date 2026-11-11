export const PRIMARY_NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/drop", label: "Merch" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const SHOP_TABS = [
  { key: "all", label: "Everything", href: "/shop" },
  { key: "amazon", label: "Amazon Pick of the Day", href: "/shop?tab=amazon" },
  { key: "closet", label: "Closet Picks", href: "/shop?tab=closet" },
] as const;
export type ShopTab = (typeof SHOP_TABS)[number]["key"];

export function parseTab(value: string | undefined): ShopTab {
  return SHOP_TABS.some((t) => t.key === value) ? (value as ShopTab) : "all";
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export const ADMIN_NAV = { href: "/admin", label: "Admin" } as const;

/** Main menu links; "Admin" is appended only when the server verified an admin session. */
export function mainNav(isAdmin: boolean, sellersEnabled = false): readonly { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [...PRIMARY_NAV];
  if (sellersEnabled) links.push({ href: "/sell", label: "Sell" });
  if (isAdmin) links.push(ADMIN_NAV);
  return links;
}
