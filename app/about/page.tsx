import type { Metadata } from "next";
import Link from "next/link";
import { LcarsBar } from "@/components/ui/lcars";
import { AMAZON_ASSOCIATES_DISCLOSURE, SHOP_SECTIONS } from "@/lib/shop/sections";

export const metadata: Metadata = { title: "About", description: "What Spock's Resale Shop is and how buying works." };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <LcarsBar className="mb-6 max-w-[200px]" />
        <p className="t-eyebrow">About</p>
        <h1 className="t-h1 mt-2">A small resale shop in Bentonville, Arkansas</h1>
        <p className="t-lead mt-4">Spock&apos;s Resale Shop sells secondhand items and shares products we recommend. The shop has three sections.</p>
      </header>

      <section className="grid gap-4">
        {[
          { s: SHOP_SECTIONS.closet, href: "/shop?tab=closet", body: "Each item is a single, real piece with its own photos and condition notes. Buy online with Stripe or pick up locally." },
          { s: SHOP_SECTIONS.affiliate, href: "/shop?tab=amazon", body: `These link to Amazon, where you buy directly from Amazon. ${AMAZON_ASSOCIATES_DISCLOSURE} Prices shown are approximate and can change on Amazon.` },
          { s: SHOP_SECTIONS.community, href: "/shop?tab=community", body: "Listings from local sellers, reviewed by us before they appear. This section is opening soon." },
        ].map(({ s, href, body }) => (
          <Link key={s.id} href={href} className="panel block p-6 hover:border-[var(--line-strong)]">
            <h2 className="t-h3">{s.title} →</h2>
            <p className="muted mt-2">{body}</p>
          </Link>
        ))}
      </section>

      <section className="panel p-6">
        <h2 className="t-h2">Buying from Spock&apos;s Closet</h2>
        <ul className="muted mt-3 grid list-disc gap-2 pl-5">
          <li>Free local pickup in Bentonville, AR, or US shipping priced by weight.</li>
          <li>Payments are processed by Stripe. We never see your card number.</li>
          <li>Items are held for you for 30 minutes while you pay.</li>
          <li>Sales tax isn&apos;t collected online yet.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/shop" className="btn btn-primary">Browse the shop</Link>
          <Link href="/contact" className="btn btn-outline">Contact us</Link>
        </div>
      </section>
    </div>
  );
}
