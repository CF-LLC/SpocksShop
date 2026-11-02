import Link from "next/link";
import type { Metadata } from "next";
import { GIFT_PAGES } from "@/lib/gifts/pages";
import { BASE, breadcrumbLd, ldScript } from "@/lib/gifts/jsonld";

export const revalidate = 3600;
const description = "Funny gift ideas for adults: original illustrated tees, hoodies, mugs, stickers and dad hats for him, her, coworkers, white elephant swaps and more.";
export const metadata: Metadata = { title: "Funny Gift Ideas for Adults", description, alternates: { canonical: `${BASE}/gifts` }, openGraph: { title: "Funny Gift Ideas for Adults", description, url: `${BASE}/gifts` }, robots: { index: true, follow: true } };

export default function GiftsIndex() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript([breadcrumbLd([["Home", "/"], ["Gifts", "/gifts"]]), { "@type": "ItemList", name: "Gift guides", itemListElement: GIFT_PAGES.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${BASE}/gifts/${p.slug}`, name: p.h1 })) }]) }} />
      <div className="dd-kicker">Gift guides</div>
      <h1>Funny gift ideas for adults</h1>
      <p className="dd-sub">Gifts from another galaxy, with jokes made for grown-ups. Every design is original artwork, printed to order on tees, hoodies, mugs, stickers and dad hats. Pick a guide below.</p>
      <div className="dd-grid" data-gift-index>
        {GIFT_PAGES.map((p) => (
          <Link key={p.slug} href={`/gifts/${p.slug}`} className="dd-card"><div className="dd-card-b"><h2 style={{ margin: "0 0 .3rem", fontSize: "1.05rem" }}>{p.h1}</h2><p className="dd-note" style={{ margin: 0 }}>{p.description}</p></div></Link>
        ))}
      </div>
    </>
  );
}
