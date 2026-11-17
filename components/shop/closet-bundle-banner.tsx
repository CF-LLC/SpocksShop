import Link from "next/link";
import { BUNDLE_BANNER_TEXT, BUNDLE_KICKER, BUNDLE_PATH, BUNDLE_TITLE_BASE } from "@/lib/shop/closet-bundle";

/** Short Closet-page invitation to the five-top bundle box. */
export function ClosetBundleBanner() {
  return (
    <section
      aria-labelledby="closet-bundle-banner-title"
      data-testid="closet-bundle-banner"
      className="panel relative mt-5 overflow-hidden p-5 sm:p-6"
    >
      <p className="t-eyebrow">{BUNDLE_KICKER}</p>
      <h2 id="closet-bundle-banner-title" className="t-h3 mt-2 max-w-2xl">
        {BUNDLE_TITLE_BASE}
      </h2>
      <p className="muted mt-2 max-w-2xl text-sm">{BUNDLE_BANNER_TEXT}</p>
      <p className="mt-4">
        <Link href={BUNDLE_PATH} className="btn btn-primary">
          Build a bundle box
        </Link>
      </p>
      <p className="hero-tech mt-4 text-[11px] tracking-[0.2em] text-stone-500 uppercase">🖖 Live long and prosper.</p>
    </section>
  );
}
