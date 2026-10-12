import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { BuyNowButton } from "@/components/buy-now-button";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { SectionHeading } from "@/components/section-heading";
import { WishlistButton } from "@/components/wishlist-button";
import { getProductBySlug, getRelatedProducts, isOnSale } from "@/lib/data";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product not found",
      description: "The requested product could not be found.",
    };
  }

  return {
    title: product.title,
    description: product.description,
    openGraph: {
      title: `${product.title} | Spock's Resale Shop`,
      description: product.description,
      type: "website",
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product || product.status !== "listed") {
    notFound();
  }

  const relatedProducts = getRelatedProducts(product, 4);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    sku: product.sku,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: product.price,
      availability: "https://schema.org/InStock",
      url: `https://spockshop.com/shop/${product.slug}`,
    },
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    itemCondition: "https://schema.org/UsedCondition",
    category: product.category,
  };

  return (
    <article className="space-y-10">
      <nav aria-label="Breadcrumb" className="font-tech text-[11px] uppercase tracking-[0.12em] text-slate-600">
        <Link href="/" className="hover:text-slate-900">
          Home
        </Link>{" "}
        /{" "}
        <Link href="/shop" className="hover:text-slate-900">
          Shop
        </Link>{" "}
        / <span className="text-slate-900">{product.title}</span>
      </nav>

      <div className="grid gap-9 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="surface-panel rounded-2xl p-4">
          <ProductGallery images={product.images} />
        </div>

        <div>
          <SectionHeading
            eyebrow={`${product.brand} · ${product.sku}`}
            title={product.title}
            description={product.description}
          />

          <div className="catalog-info-line mt-4 flex flex-wrap items-center gap-2 py-2">
            <span className="chip">{product.condition}</span>
            <span className="chip">{toTitleCase(product.category)}</span>
            <span className="chip">{product.subcategory}</span>
            <span className="chip">Status: {product.quantity > 0 ? "Available" : "Sold"}</span>
            {isOnSale(product) ? <span className="chip bg-amber-100">On Sale</span> : null}
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <p className="text-3xl font-semibold text-slate-900">
              {formatCurrency(product.price)}
            </p>
            {product.originalPrice ? (
              <p className="text-lg text-slate-500 line-through">
                {formatCurrency(product.originalPrice)}
              </p>
            ) : null}
          </div>

          <p className="mt-4 text-sm text-slate-700">
            Condition Notes: {product.conditionNotes}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <AddToCartButton productId={product.id} />
            <BuyNowButton productId={product.id} />
            <WishlistButton productId={product.id} />
          </div>

          <dl className="catalog-card mt-7 grid gap-3 rounded-xl p-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">SKU</dt>
              <dd className="font-medium text-slate-900">{product.sku}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Color</dt>
              <dd className="font-medium text-slate-900">{product.color}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Size</dt>
              <dd className="font-medium text-slate-900">{product.size}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Weight</dt>
              <dd className="font-medium text-slate-900">{product.weightLb} lb</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Dimensions</dt>
              <dd className="font-medium text-slate-900">
                {product.dimensions.lengthIn}in × {product.dimensions.widthIn}in ×{" "}
                {product.dimensions.heightIn}in
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Date Listed</dt>
              <dd className="font-medium text-slate-900">{formatDate(product.dateListed)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="catalog-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900">Shipping Information</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            Ships within 1-2 business days. Orders are packed with recyclable padding and
            tracking is provided by email.
          </p>
        </div>
        <div className="catalog-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900">Return Information</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            14-day returns for items that arrive damaged or significantly different from the
            listing. Condition notes are documented for every item.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Cross-listing"
          title="Marketplace Listings"
          description="This inventory can be listed across trusted resale channels."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {product.marketplaceListing.map((listing) => (
            <article key={listing.listingId} className="catalog-card rounded-xl p-4 text-sm">
              <p className="font-semibold text-slate-900">{listing.channel}</p>
              <p className="mt-1 text-slate-600">Status: {listing.status}</p>
              <a
                href={listing.listingUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-text mt-2 inline-flex"
              >
                View listing
              </a>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Keep browsing"
          title="Related Products"
          description="More finds from the same category and subcategory."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {relatedProducts.map((related) => (
            <ProductCard key={related.id} product={related} />
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
    </article>
  );
}
