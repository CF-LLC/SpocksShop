import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { BuyBox } from "@/components/shop/buy-box";
import { Gallery } from "@/components/shop/gallery";
import { ProductCard } from "@/components/shop/product-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getClosetProducts, getListedProductBySlug, isPurchasable } from "@/lib/catalog";
import { formatCents } from "@/lib/commerce/money";
import { db } from "@/lib/db";
import { shippingRates } from "@/lib/db/schema";
import { SHOP_SECTIONS } from "@/lib/shop/sections";
import { stripeSettings } from "@/lib/stripe";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = await getListedProductBySlug((await params).slug);
  if (!product) return { title: "Item not found" };
  return { title: product.title, description: product.description.slice(0, 160) || `${product.title} at Spock's Resale Shop.`, alternates: { canonical: `/shop/${product.slug}` } };
}

async function activeRates() {
  try {
    return await db.select().from(shippingRates).where(eq(shippingRates.isActive, true)).orderBy(asc(shippingRates.amountCents));
  } catch {
    return [];
  }
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getListedProductBySlug(slug);
  if (!product) notFound();

  const section = { label: SHOP_SECTIONS.closet.title, href: "/shop?tab=closet" };
  const [rates, others] = await Promise.all([activeRates(), product.source === "closet" ? getClosetProducts() : Promise.resolve([])]);
  const related = others.filter((p) => p.id !== product.id).slice(0, 4);
  const purchasable = isPurchasable(product);
  const sold = product.status === "sold" || product.available === 0;
  const reason = sold
    ? "This one has found a new home. It was one of a kind."
    : product.source === "community" && !purchasable
      ? "Checkout for this seller item isn't open yet. Contact us if you're interested in it."
      : undefined;
  const fromRate = rates[0]?.amountCents;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    sku: product.sku,
    ...(product.hasPhotos ? { image: product.images.map((i) => i.src) } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: (product.priceCents / 100).toFixed(2),
      availability: sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      itemCondition: product.condition === "New" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    },
  };

  return (
    <article className="pb-24 md:pb-0">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/shop", label: "Shop" }, { href: section.href, label: section.label }, { label: product.title }]} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={product.images} title={product.title} />

        <div className="space-y-5">
          <div>
            <p className="t-eyebrow">{product.source === "community" ? `Closet Picks · Sold by ${product.sellerName ?? "a seller"}` : "Closet Picks · One of a kind"}</p>
            <h1 className="t-h1 mt-2">{product.title}</h1>
          </div>
          <div className="flex items-baseline gap-3">
            <p className="price text-3xl">{formatCents(product.priceCents)}</p>
            {product.originalPriceCents && product.originalPriceCents > product.priceCents ? <p className="dim text-lg line-through">{formatCents(product.originalPriceCents)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="chip chip-gold">{product.condition}</span>
            {product.categoryName ? <span className="chip">{product.categoryName}</span> : null}
            {product.brand ? <span className="chip">{product.brand}</span> : null}
            <span className="chip">{sold ? "Sold" : product.available > 1 ? `${product.available} available` : "1 available"}</span>
          </div>

          <BuyBox
            product={{ id: product.id, slug: product.slug, title: product.title, priceCents: product.priceCents, image: product.hasPhotos ? product.images[0].src : null, available: product.available }}
            purchasable={purchasable}
            checkoutEnabled={stripeSettings().checkoutEnabled}
            reason={reason}
          />
          {sold ? (
            <div className="flex flex-wrap gap-3">
              <Link href={section.href} className="btn btn-primary">More from {section.label}</Link>
              <Link href="/shop?tab=amazon" className="btn btn-outline">Amazon Picks</Link>
            </div>
          ) : null}

          {product.description ? (
            <section>
              <h2 className="t-h3 mb-2">Details</h2>
              <p className="muted whitespace-pre-line">{product.description}</p>
            </section>
          ) : null}
          {product.conditionNotes ? (
            <section>
              <h2 className="t-h3 mb-2">Condition notes</h2>
              <p className="muted whitespace-pre-line">{product.conditionNotes}</p>
            </section>
          ) : null}

          <section className="panel p-5">
            <h2 className="t-h3 mb-2">Pickup &amp; shipping</h2>
            <ul className="muted grid gap-1 text-sm">
              <li>Free local pickup in Bentonville, Arkansas.</li>
              <li>{fromRate != null ? `US shipping by weight, from ${formatCents(fromRate)}.` : "US shipping by weight, quoted at checkout."}</li>
              <li>Sales tax isn&apos;t collected online yet.</li>
            </ul>
            <p className="mt-3 text-sm"><Link href="/contact" className="link">Questions about this item?</Link></p>
          </section>
        </div>
      </div>

      {related.length ? (
        <section className="mt-16" aria-labelledby="related-title">
          <h2 id="related-title" className="t-h2 mb-6">More from {section.label}</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{related.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</ul>
        </section>
      ) : (
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/shop" className="btn btn-outline">Back to the shop</Link>
          <Link href="/shop?tab=amazon" className="btn btn-ghost">See Amazon Picks</Link>
        </div>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </article>
  );
}
