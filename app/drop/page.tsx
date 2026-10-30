import Link from "next/link";
import { DESIGNS, PRICES_CENTS } from "@/lib/drop/config";

const usd = (c: number) => `$${(c / 100).toFixed(0)}`;

export default function DropHome() {
  return (
    <>
      <div className="dd-kicker">The Daily Drop</div>
      <h1>Shirts from another galaxy.</h1>
      <p className="dd-sub">Ten original illustrated designs, printed to order. Tees {usd(PRICES_CENTS.tee)}, hoodies {usd(PRICES_CENTS.hoodie)}.</p>
      {DESIGNS.length === 0 ? (
        <div className="dd-panel">Nothing in orbit right now. Check back soon.</div>
      ) : (
        <div className="dd-grid">
          {DESIGNS.map((d) => (
            <Link key={d.slug} href={`/drop/${d.slug}`} className="dd-card">
              <div className="dd-shirt"><img src={`/drop/art/${d.file}.webp`} alt={d.title} loading="lazy" /></div>
              <div className="dd-card-b"><h3>{d.title}</h3><div className="dd-price">from {usd(PRICES_CENTS.tee)}</div></div>
            </Link>
          ))}
        </div>
      )}
      <p className="dd-note" style={{ marginTop: "2rem" }}><Link href="/drop/policies">Shipping, returns &amp; terms</Link> · Questions: <a href="mailto:support@spockshop.com">support@spockshop.com</a></p>
    </>
  );
}
