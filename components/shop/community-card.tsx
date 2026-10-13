import Link from "next/link";
import { formatCents } from "@/lib/commerce/money";
import { mediaUrl } from "@/lib/media";
import type { CommunityCard as Item } from "@/lib/shop/queries";

export function CommunityCard({ item }: { item: Item }) {
  return (
    <article className="card">
      <div className="card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photoPath ? mediaUrl(item.photoPath) : "/placeholder.svg"} alt="" loading="lazy" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="dim text-xs font-semibold uppercase tracking-wider">Sold by {item.sellerName}</p>
        <h3 className="font-semibold leading-snug">
          {item.slug ? <Link href={`/shop/${item.slug}`} className="stretched">{item.title}</Link> : item.title}
        </h3>
        <p className="price mt-auto pt-2 text-lg">{formatCents(item.priceCents)}</p>
      </div>
    </article>
  );
}
