import Link from "next/link";
import { DropSignup } from "@/components/drop/signup-form";
import { DESIGNS, PRICES_CENTS, isHeld } from "@/lib/drop/config";
import { getSession } from "@/lib/auth/session";
import { artUrl, heroImage, mockupUrl } from "@/lib/drop/mockups";

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
      <p className="dd-sub">{live} original illustrated designs, printed to order on tees ({usd(PRICES_CENTS.tee)}), hoodies ({usd(PRICES_CENTS.hoodie)}), mugs (from {usd(PRICES_CENTS.mug)}), stickers (from {usd(PRICES_CENTS.sticker)}) and dad hats ({usd(PRICES_CENTS.hat)}).</p>
      <p className="dd-panel" data-deals-banner><strong>Deals:</strong> Tee + Hoodie bundle $72 (save $4) · 2 tees for $52 (save $4). Applied automatically at checkout.</p>
      {shown.length === 0 ? (
        <div className="dd-panel">Nothing in orbit right now. Check back soon.</div>
      ) : (
        <div className="dd-grid">
          {shown.map((d) => (
            <Link key={d.slug} href={`/drop/${d.slug}`} className="dd-card">
              <div className={`dd-shirt${mockupUrl(d, "tee") ? " dd-mock" : ""}`}><img src={heroImage(d)} alt={`${d.title} on a tee`} loading="lazy" />{mockupUrl(d, "tee") ? <img className="dd-mini" src={artUrl(d)} alt="" loading="lazy" /> : null}</div>
              <div className="dd-card-b"><h3>{isHeld(d.slug) ? <span data-held>HELD · </span> : null}{d.title}</h3><div className="dd-price">from {usd(PRICES_CENTS.sticker)} · tees, mugs, hats &amp; more</div></div>
            </Link>
          ))}
        </div>
      )}
      <p className="dd-note" data-gift-links style={{ marginTop: "1.5rem" }}>Gift ideas: <Link href="/gifts">all gift guides</Link> · <Link href="/gifts/funny-gifts-for-him">for him</Link> · <Link href="/gifts/funny-gifts-for-her">for her</Link> · <Link href="/gifts/funny-coworker-gifts">for coworkers</Link> · <Link href="/gifts/funny-white-elephant-gifts">white elephant</Link> · <Link href="/gifts/funny-drinking-gifts">drinking</Link></p>
      <DropSignup source="drop" />
      <p className="dd-note" style={{ marginTop: "2rem" }}><Link href="/drop/policies">Shipping, returns &amp; terms</Link> · Questions: <a href="mailto:support@spockshop.com">support@spockshop.com</a></p>
    </>
  );
}
