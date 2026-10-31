import Link from "next/link";
import { DESIGNS, PRICES_CENTS, isHeld } from "@/lib/drop/config";
import { getSession } from "@/lib/auth/session";

// Per-request: held designs are shown (marked HELD) only to a signed-in admin.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

export default async function DropHome() {
  const isAdmin = (await getSession().catch(() => null))?.role === "admin";
  const shown = DESIGNS.filter((d) => isAdmin || !isHeld(d.slug));
  const live = DESIGNS.filter((d) => !isHeld(d.slug)).length;
  return (
    <>
      <div className="dd-kicker">The Daily Drop</div>
      <h1>Shirts from another galaxy.</h1>
      <p className="dd-sub">{live} original illustrated designs, printed to order. Tees {usd(PRICES_CENTS.tee)}, hoodies {usd(PRICES_CENTS.hoodie)}.</p>
      {shown.length === 0 ? (
        <div className="dd-panel">Nothing in orbit right now. Check back soon.</div>
      ) : (
        <div className="dd-grid">
          {shown.map((d) => (
            <Link key={d.slug} href={`/drop/${d.slug}`} className="dd-card">
              <div className="dd-shirt"><img src={`/drop/art/${d.file}.webp`} alt={d.title} loading="lazy" /></div>
              <div className="dd-card-b"><h3>{isHeld(d.slug) ? <span data-held>HELD · </span> : null}{d.title}</h3><div className="dd-price">from {usd(PRICES_CENTS.tee)}</div></div>
            </Link>
          ))}
        </div>
      )}
      <p className="dd-note" style={{ marginTop: "2rem" }}><Link href="/drop/policies">Shipping, returns &amp; terms</Link> · Questions: <a href="mailto:support@spockshop.com">support@spockshop.com</a></p>
    </>
  );
}
