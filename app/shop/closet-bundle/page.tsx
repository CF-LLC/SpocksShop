import type { Metadata } from "next";
import Link from "next/link";
import { ClosetBundleBuyBox } from "@/components/shop/closet-bundle-buy-box";
import { HolidayCutoffBanner } from "@/components/shop/holiday-cutoff-banner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getClosetBundleProducts } from "@/lib/catalog";
import { formatCents } from "@/lib/commerce/money";
import { listActiveShippingRates } from "@/lib/commerce/shipping-rates";
import {
  BUNDLE_HEADLINE,
  BUNDLE_IMAGE,
  BUNDLE_KICKER,
  BUNDLE_PRICE_CENTS,
  BUNDLE_TITLE_BASE,
  BUNDLE_TOP_COUNT,
  BUNDLE_SIZES,
  BUNDLE_WEIGHT_LB,
  bundleShippingSentence,
  parseBundleSize,
} from "@/lib/shop/closet-bundle";
import { SHOP_SECTIONS } from "@/lib/shop/sections";
import { stripeSettings } from "@/lib/stripe";

type Params = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Closet Bundle Box — 5 tops, one shipping fee",
  description:
    "Five secondhand Closet tops in your size, packed as one box for $14.99 plus one US shipping fee. You pick the size; I pick the shirts from current Closet stock.",
  alternates: { canonical: "/shop/closet-bundle" },
};

export default async function ClosetBundlePage({ searchParams }: Params) {
  const params = await searchParams;
  const raw = params.size;
  const initialSize = parseBundleSize(Array.isArray(raw) ? raw[0] : raw);
  const [products, rates] = await Promise.all([getClosetBundleProducts(), listActiveShippingRates()]);
  const sized = products.flatMap((p) => {
    const size = BUNDLE_SIZES.find((s) => s.sku === p.sku)?.size;
    if (!size) return [];
    return [{
      size,
      id: p.id,
      slug: p.slug,
      title: p.title,
      priceCents: p.priceCents,
      available: p.available,
      image: p.hasPhotos ? p.images[0].src : BUNDLE_IMAGE.src,
    }];
  });

  return (
    <article className="pb-24 md:pb-0">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          { href: "/shop", label: SHOP_SECTIONS.closet.title },
          { label: BUNDLE_TITLE_BASE },
        ]}
      />

      <HolidayCutoffBanner />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="panel overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BUNDLE_IMAGE.src}
            alt={BUNDLE_IMAGE.alt}
            width={BUNDLE_IMAGE.width}
            height={BUNDLE_IMAGE.height}
            className="h-auto w-full"
          />
        </div>

        <div className="space-y-5">
          <div>
            <p className="t-eyebrow">{BUNDLE_KICKER}</p>
            <h1 className="t-h1 mt-2">{BUNDLE_TITLE_BASE}</h1>
            <p className="t-lead mt-3">{BUNDLE_HEADLINE}</p>
          </div>
          <p className="price text-3xl">{formatCents(BUNDLE_PRICE_CENTS)}</p>
          <p className="muted">
            {BUNDLE_TOP_COUNT} secondhand tops in the size you pick, from current Closet stock. I choose the shirts — the exact tops aren&apos;t listed in advance.
            Condition varies by piece, typically Good or better.
          </p>
          <p className="muted text-sm">{bundleShippingSentence(rates)}</p>

          {sized.length ? (
            <ClosetBundleBuyBox sizes={sized} initialSize={initialSize} checkoutEnabled={stripeSettings().checkoutEnabled} />
          ) : (
            <p className="notice">The bundle box isn&apos;t listed yet. You can still shop individual Closet Picks.</p>
          )}

          <section className="panel p-5">
            <h2 className="t-h3 mb-2">What you get</h2>
            <ul className="muted grid gap-1 text-sm">
              <li>Five tops in one adult size, packed as a single box.</li>
              <li>One US shipping fee for the {BUNDLE_WEIGHT_LB} lb box, from the same Closet weight table as other Closet Picks.</li>
              <li>If I can&apos;t fill your size, I&apos;ll email you to switch sizes or I&apos;ll refund you.</li>
            </ul>
            <p className="mt-3 text-sm">
              <Link href="/shop" className="link">Or pick individual Closet Picks</Link>
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
