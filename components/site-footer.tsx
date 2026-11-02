import Link from "next/link";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";
import { LcarsBar } from "@/components/ui/lcars";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--space-1)_85%,transparent)]">
      <div className="container-x py-10">
        <LcarsBar className="mb-8 max-w-xs" />
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold">🖖 Spock&apos;s Resale Shop</p>
            <p className="muted mt-2 text-sm">Live long and prosper. Based in Bentonville, Arkansas.</p>
          </div>
          <nav aria-label="Footer">
            <p className="t-eyebrow mb-2">Explore</p>
            <ul className="grid gap-1 text-sm">
              {[["/drop", "Merch"], ["/shop?tab=amazon", "Amazon Picks"], ["/shop?tab=closet", "Closet Picks"], ["/guides", "Guides"], ["https://blog.spockshop.com", "Blog"], ["/about", "About"], ["/contact", "Contact"]].map(([href, label]) => (
                <li key={href}><Link href={href} className="muted inline-flex min-h-[36px] items-center hover:text-[var(--text)]">{label}</Link></li>
              ))}
            </ul>
          </nav>
          <div className="text-sm">
            <p className="t-eyebrow mb-2">Good to know</p>
            <p className="muted">{AMAZON_ASSOCIATES_DISCLOSURE}</p>
          </div>
        </div>
        <p className="dim mt-8 text-xs">© {new Date().getFullYear()} Spock&apos;s Resale Shop</p>
      </div>
    </footer>
  );
}
