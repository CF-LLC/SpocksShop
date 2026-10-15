import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { publishedGuides } from "@/lib/guides/load";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guides",
  description: "Hand-picked Star Trek gift guides and Amazon recommendations from Spock's Resale Shop.",
  alternates: { canonical: "/guides" },
  openGraph: { title: "Guides | Spock's Resale Shop", description: "Hand-picked Star Trek gift guides and Amazon recommendations.", url: "/guides", type: "website" },
};

export default async function GuidesIndex() {
  const guides = await publishedGuides();
  return (
    <div>
      <header className="mb-8">
        <p className="dim mb-4 text-sm" data-testid="amazon-disclosure">{AMAZON_ASSOCIATES_DISCLOSURE}</p>
        <p className="t-eyebrow mb-2">Guides</p>
        <h1 className="t-h1">Gift guides &amp; picks</h1>
      </header>
      {guides.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {guides.map((g) => (
            <li key={g.slug} className="card p-5">
              <h2 className="text-lg font-semibold"><Link href={`/guides/${g.slug}`} className="stretched">{g.title}</Link></h2>
              {g.description ? <p className="muted mt-2 text-sm">{g.description}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Guides are on the way" body="We're writing our first gift guides." actions={[{ href: "/shop?tab=amazon", label: "Browse Amazon Picks" }]} />
      )}
    </div>
  );
}
