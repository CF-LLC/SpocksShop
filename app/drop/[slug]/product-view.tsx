"use client";
import { useState } from "react";
import type { Garment } from "@/lib/drop/config";
import type { GalleryImage } from "@/lib/drop/mockups";
import { BuyBox } from "./buy-box";

/** Mockup gallery + buy box share the selected product type: picking Hoodie shows the hoodie photo and vice versa. */
export function ProductView({ slug, title, garments, images, adminPrices, children }: { slug: string; title: string; garments: Garment[]; images: GalleryImage[]; adminPrices?: Record<string, number>; children: React.ReactNode }) {
  const [garment, setGarment] = useState<Garment>(garments[0]);
  const [pick, setPick] = useState<string | null>(null);
  const forType = images.find((i) => i.garment === garment);
  const main = images.find((i) => i.key === pick) ?? forType ?? images[images.length - 1];
  return (
    <div className="dd-prod">
      <div>
        <div className="dd-card"><div className={`dd-shirt${main.mockup ? " dd-mock" : ""}`}><img src={main.src} alt={`${title}: ${main.label}`} data-main-image={main.key} /></div></div>
        <div className="dd-thumbs" role="group" aria-label="Photos">
          {images.map((i) => (
            <button key={i.key} type="button" className="dd-thumb" aria-pressed={i.key === main.key} aria-label={i.label} title={i.label} data-thumb={i.key}
              onClick={() => { setPick(i.key); if (i.garment) { setGarment(i.garment); setPick(null); } }}>
              <img src={i.src} alt="" loading="lazy" />
              {i.swatch ? <span className="dd-swatch" style={{ background: i.swatch }} aria-hidden /> : null}
            </button>
          ))}
        </div>
        <p className="dd-note">{main.mockup ? `Shown: ${main.label}. ` : ""}Photos are printer mockups; each item is printed to order.</p>
      </div>
      <div>
        {children}
        <BuyBox slug={slug} garments={garments} adminPrices={adminPrices} garment={garment} onGarment={(g) => { setGarment(g); setPick(null); }} />
      </div>
    </div>
  );
}
