import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GIFT_PAGES, designsFor, giftPage } from "@/lib/gifts/pages";
import { BASE, breadcrumbLd, itemListLd, ldScript } from "@/lib/gifts/jsonld";
import { GiftGrid } from "../grid";

export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = () => GIFT_PAGES.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = giftPage((await params).slug);
  if (!p) return {};
  const url = `${BASE}/gifts/${p.slug}`;
  return { title: p.title, description: p.description, alternates: { canonical: url }, openGraph: { title: p.title, description: p.description, url, type: "website" }, robots: { index: true, follow: true } };
}

export default async function GiftLanding({ params }: { params: Promise<{ slug: string }> }) {
  const p = giftPage((await params).slug);
  if (!p) notFound();
  const designs = designsFor(p.designs, process.env, p.show);
  const others = GIFT_PAGES.filter((o) => o.slug !== p.slug);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript([breadcrumbLd([["Home", "/"], ["Gifts", "/gifts"], [p.h1, `/gifts/${p.slug}`]]), itemListLd(p.h1, designs)]) }} />
      <nav className="dd-note" aria-label="Breadcrumb"><Link href="/">Home</Link> › <Link href="/gifts">Gifts</Link> › <span>{p.h1}</span></nav>
      <div className="dd-kicker">Gift guide</div>
      <h1>{p.h1}</h1>
      <p className="dd-sub">{p.intro}</p>
      <GiftGrid designs={designs} show={p.show} />
      <section className="dd-panel">
        <h2 style={{ marginTop: 0, fontSize: "1.2rem" }}>Gifting tips</h2>
        <ul>{p.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        <p className="dd-note">Live long and prosper, and laugh a little. <Link href="/drop">See every Daily Drop design</Link> · <Link href="/drop/policies">Shipping &amp; returns</Link></p>
      </section>
      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>More gift ideas</h2>
        <ul className="dd-note" style={{ columns: 2 }}>{others.map((o) => <li key={o.slug}><Link href={`/gifts/${o.slug}`}>{o.h1}</Link></li>)}</ul>
      </section>
    </>
  );
}
