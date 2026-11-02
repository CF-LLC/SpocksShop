import type { Metadata } from "next";
import { heroImage } from "@/lib/drop/mockups";
import { productLd, breadcrumbLd, ldScript } from "@/lib/gifts/jsonld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { designBySlug, isHeld } from "@/lib/drop/config";
import { getSession } from "@/lib/auth/session";
import { adminCostPrice } from "@/lib/drop/admin-cost";
import { SIZES } from "@/lib/drop/config";
import { ProductView } from "./product-view";
import { gallery } from "@/lib/drop/mockups";

// Per-request render (reads the admin cookie); never cached across users.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = designBySlug((await params).slug);
  // Held/unknown designs: page 404s for the public; never indexable even for an admin preview.
  if (!d || isHeld(d.slug)) return { title: "Not found", robots: { index: false, follow: false } };
  const url = `https://spockshop.com/drop/${d.slug}`;
  const description = `${d.title}: ${d.blurb} Original illustrated design on tees ($28), hoodies ($48), mugs, stickers and dad hats. Printed to order.`.slice(0, 200);
  const image = `https://spockshop.com${heroImage(d)}`;
  return { title: `${d.title} Tee, Hoodie & Mug`, description, alternates: { canonical: url }, openGraph: { title: d.title, description, url, images: [image] }, robots: { index: true, follow: true } };
}

export default async function DropProduct({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = designBySlug(slug);
  if (!d) notFound();
  const isAdmin = (await getSession().catch(() => null))?.role === "admin";
  const held = isHeld(d.slug);
  if (held && !isAdmin) notFound();
  // Admin-only: per garment:size cost price (pre-tax cents). Never computed or sent for anyone else.
  let adminPrices: Record<string, number> | undefined;
  if (isAdmin) {
    adminPrices = {};
    for (const g of d.garments) for (const size of SIZES[g]) {
      const p = adminCostPrice([{ slug: d.slug, garment: g, size, qty: 1 }]);
      if (p) adminPrices[`${g}:${size}`] = p.preTax;
    }
  }
  return (
    <>
      <Link href="/drop" className="dd-note">← All designs</Link>
      {held ? (
        <div className="dd-prod">
          <div className="dd-card"><div className="dd-shirt"><img src={`/drop/art/${d.file}.webp`} alt={d.title} /></div></div>
          <div>
            <h1 style={{ fontSize: "clamp(1.6rem,4.5vw,2.4rem)" }}>{d.title}</h1>
            <p className="dd-panel" data-held>HELD: not public and not purchasable yet (admin preview only).</p>
          </div>
        </div>
      ) : (
        <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript([productLd(d), breadcrumbLd([["Home", "/"], ["The Daily Drop", "/drop"], [d.title, `/drop/${d.slug}`]])]) }} />
        <ProductView slug={d.slug} title={d.title} garments={d.garments} images={gallery(d)} adminPrices={adminPrices}>
          <div className="dd-kicker">The Daily Drop</div>
          <h1 style={{ fontSize: "clamp(1.6rem,4.5vw,2.4rem)" }}>{d.title}</h1>
          <p className="dd-sub">{d.blurb}</p>
          <p className="dd-note">Available on tees, hoodies, 11oz/15oz mugs, kiss-cut stickers and dad hats.</p>
        </ProductView>
        </>
      )}
    </>
  );
}
