"use client";

import { useState } from "react";
import type { ProductImage } from "@/lib/types";

export function Gallery({ images, title }: { images: ProductImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const img = images[active] ?? images[0];
  return (
    <div>
      <div className="card-media overflow-hidden rounded-[22px] border border-[var(--line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={img.alt || title} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="More photos">
          {images.map((im, i) => (
            <li key={im.id}>
              <button type="button" onClick={() => setActive(i)} aria-label={`Photo ${i + 1} of ${images.length}`} aria-pressed={i === active} className={`h-16 w-16 overflow-hidden rounded-xl border-2 ${i === active ? "border-[var(--gold)]" : "border-transparent"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.src} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
