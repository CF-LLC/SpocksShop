import Link from "next/link";
import { formatCents } from "@/lib/commerce/money";
import type { Product } from "@/lib/types";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const img = product.images[0];
  return (
    <article className="card">
      <div className="card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={product.hasPhotos ? img.alt : ""} loading={priority ? "eager" : "lazy"} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="dim text-xs font-semibold uppercase tracking-wider">{product.source === "community" ? `Closet Picks · ${product.sellerName ?? "Seller"}` : "Closet Picks"}</p>
        <h3 className="font-semibold leading-snug">
          <Link href={`/shop/${product.slug}`} className="stretched">{product.title}</Link>
        </h3>
        <p className="muted text-sm">{product.condition}</p>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="price text-lg">{formatCents(product.priceCents)}</span>
          {product.originalPriceCents && product.originalPriceCents > product.priceCents ? <span className="dim text-sm line-through">{formatCents(product.originalPriceCents)}</span> : null}
        </div>
      </div>
    </article>
  );
}
