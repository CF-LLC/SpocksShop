export const PRIMARY_NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const SHOP_TABS = [
  { key: "all", label: "Everything", href: "/shop" },
  { key: "amazon", label: "Amazon Picks", href: "/shop?tab=amazon" },
  { key: "closet", label: "Spock's Closet", href: "/shop?tab=closet" },
  { key: "community", label: "Community Market", href: "/shop?tab=community" },
] as const;
export type ShopTab = (typeof SHOP_TABS)[number]["key"];

export function parseTab(value: string | undefined): ShopTab {
  return SHOP_TABS.some((t) => t.key === value) ? (value as ShopTab) : "all";
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
