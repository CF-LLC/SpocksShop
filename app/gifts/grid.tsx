import Link from "next/link";
import { PRICES_CENTS, type Design } from "@/lib/drop/config";
import { artUrl, mockupUrl, sizedImg, type MockupType } from "@/lib/drop/mockups";

const usd = (c: number) => `$${(c / 100).toFixed(0)}`;
const LABEL: Record<MockupType, string> = { tee: "tee", hoodie: "hoodie", mug: "mug" };

export function GiftGrid({ designs, show }: { designs: Design[]; show: MockupType }) {
  return (
    <div className="dd-grid" data-gift-grid>
      {designs.map((d, i) => {
        const img = mockupUrl(d, show) ?? artUrl(d);
        return (
          <Link key={d.slug} href={`/drop/${d.slug}`} className="dd-card" data-design={d.slug}>
            <div className={`dd-shirt${mockupUrl(d, show) ? " dd-mock" : ""}`}><img {...sizedImg(img, "(max-width: 520px) 92vw, (max-width: 1100px) 45vw, 260px")} alt={`${d.title} ${LABEL[show]}`} loading={i < 4 ? "eager" : "lazy"} {...(i === 0 ? { fetchPriority: "high" as const } : {})} decoding="async" width={480} height={480} /></div>
            <div className="dd-card-b">
              <h3>{d.title}</h3>
              <p className="dd-note" style={{ margin: "0 0 .3rem" }}>{d.blurb}</p>
              <div className="dd-price">Tee {usd(PRICES_CENTS.tee)} · Hoodie {usd(PRICES_CENTS.hoodie)} · Mug from {usd(PRICES_CENTS.mug)} · Sticker from {usd(PRICES_CENTS.sticker)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
