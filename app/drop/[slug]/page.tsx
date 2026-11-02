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
        <ProductView slug={d.slug} title={d.title} garments={d.garments} images={gallery(d)} adminPrices={adminPrices}>
          <div className="dd-kicker">The Daily Drop</div>
          <h1 style={{ fontSize: "clamp(1.6rem,4.5vw,2.4rem)" }}>{d.title}</h1>
          <p className="dd-sub">{d.blurb}</p>
          <p className="dd-note">Available on tees, hoodies, 11oz/15oz mugs, kiss-cut stickers and dad hats.</p>
        </ProductView>
      )}
    </>
  );
}
