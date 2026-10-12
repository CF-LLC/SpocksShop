import Link from "next/link";
import { BRAND, navLinks, policies } from "@/lib/data";
import { StarField } from "@/components/visual/star-field";
import { OrbitalDecoration } from "@/components/visual/orbital-decoration";
import { Constellation } from "@/components/visual/constellation";

const socialLinks = [
  { href: "#", label: "Instagram" },
  { href: "#", label: "Facebook" },
  { href: "#", label: "TikTok" },
];

export function SiteFooter() {
  return (
    <footer className="footer-dark mt-20 text-stone-100">
      {/* Upper: expedition-end statement */}
      <div className="relative overflow-hidden">
        {/* Star field background */}
        <div className="absolute inset-0 z-0">
          <StarField starCount={80} speed={0.3} />
        </div>

        {/* Orbital decoration */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 h-72 w-72 opacity-20 pointer-events-none"
          aria-hidden="true"
        >
          <OrbitalDecoration size="lg" accent="gold" rings={3} />
        </div>

        {/* Constellation decoration */}
        <div
          className="absolute left-0 bottom-0 h-48 w-56 opacity-25 pointer-events-none"
          aria-hidden="true"
        >
          <Constellation
            points={10}
            lineColor="rgba(196,154,85,0.5)"
            dotColor="rgba(196,154,85,0.7)"
            animated={false}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-16 md:px-8">
          <p className="font-tech text-[10px] uppercase tracking-[0.22em] text-stone-600">
            Expedition Complete · SRS-01
          </p>
          <p className="font-display mt-3 text-[clamp(2.5rem,7vw,5rem)] leading-[0.88] tracking-tight text-stone-100">
            LIVE LONG
            <br />
            AND PROSPER.
          </p>
          <p className="mt-4 text-base text-stone-400">
            Thanks for exploring. Come back soon — the universe is still full of finds.
          </p>
        </div>
      </div>

      {/* Lower: navigation */}
      <div className="border-t border-stone-800">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-10 md:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <p className="font-tech text-[10px] uppercase tracking-[0.16em] text-stone-500">
                Brand
              </p>
              <p className="mt-3 text-sm font-semibold text-stone-300">{BRAND.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                Curated secondhand finds with field-notes transparency. Every item has a story.
              </p>
            </div>

            <div>
              <h2 className="font-tech text-[10px] uppercase tracking-[0.16em] text-stone-500">
                Navigation
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-stone-400">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-stone-200 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-tech text-[10px] uppercase tracking-[0.16em] text-stone-500">
                Contact
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-stone-400">
                <li>
                  <a href="mailto:support@spockshop.com" className="hover:text-stone-200 transition-colors">
                    support@spockshop.com
                  </a>
                </li>
                <li>Bentonville, Arkansas</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="font-tech text-[10px] uppercase tracking-[0.14em] text-stone-500 hover:text-stone-200 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-tech text-[10px] uppercase tracking-[0.16em] text-stone-500">
                Policies
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-stone-400">
                {policies.map((policy) => (
                  <li key={policy.href}>
                    <Link href={policy.href} className="hover:text-stone-200 transition-colors">
                      {policy.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800 pt-6">
            <p className="font-tech text-[10px] tracking-[0.14em] text-stone-600">
              © {new Date().getFullYear()} {BRAND.name} · Independent resale brand
            </p>
            <p className="font-tech text-[10px] tracking-[0.14em] text-stone-600">
              Not affiliated with Star Trek or Paramount Pictures
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

