import Link from "next/link";
import { notFound } from "next/navigation";
import { designBySlug, isHeld } from "@/lib/drop/config";
import { getSession } from "@/lib/auth/session";
import { adminCostPrice } from "@/lib/drop/admin-cost";
import { SIZES } from "@/lib/drop/config";
import { BuyBox } from "./buy-box";

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
      <div className="dd-prod">
        <div className="dd-card"><div className="dd-shirt"><img src={`/drop/art/${d.file}.webp`} alt={d.title} /></div></div>
        <div>
          <div className="dd-kicker">The Daily Drop</div>
          <h1 style={{ fontSize: "clamp(1.6rem,4.5vw,2.4rem)" }}>{d.title}</h1>
          <p className="dd-sub">{d.blurb}</p>
          {held ? <p className="dd-panel" data-held>HELD: not public and not purchasable yet (admin preview only).</p> : <BuyBox slug={d.slug} garments={d.garments} adminPrices={adminPrices} />}
        </div>
      </div>
    </>
  );
}
