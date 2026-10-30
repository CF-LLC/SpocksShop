import Link from "next/link";
import { notFound } from "next/navigation";
import { designBySlug } from "@/lib/drop/config";
import { BuyBox } from "./buy-box";

export default async function DropProduct({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = designBySlug(slug);
  if (!d) notFound();
  return (
    <>
      <Link href="/drop" className="dd-note">← All designs</Link>
      <div className="dd-prod">
        <div className="dd-card"><div className="dd-shirt"><img src={`/drop/art/${d.file}.webp`} alt={d.title} /></div></div>
        <div>
          <div className="dd-kicker">The Daily Drop</div>
          <h1 style={{ fontSize: "clamp(1.6rem,4.5vw,2.4rem)" }}>{d.title}</h1>
          <p className="dd-sub">{d.blurb}</p>
          <BuyBox slug={d.slug} garments={d.garments} />
        </div>
      </div>
    </>
  );
}
