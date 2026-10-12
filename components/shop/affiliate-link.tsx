import { affiliateUrlFor } from "@/lib/commerce/affiliate";
import { AFFILIATE_LINK_REL, AFFILIATE_LINK_TARGET } from "@/lib/shop/sections";

/** The only way to render an Amazon link: always tagged, sponsored, new tab. */
export function AffiliateLink({
  item,
  className,
  children,
}: {
  item: { amazonUrl?: string | null; asin?: string | null };
  className?: string;
  children: React.ReactNode;
}) {
  let href: string;
  try {
    href = affiliateUrlFor(item);
  } catch {
    return null;
  }
  return (
    <a href={href} rel={AFFILIATE_LINK_REL} target={AFFILIATE_LINK_TARGET} className={className}>
      {children}
    </a>
  );
}
