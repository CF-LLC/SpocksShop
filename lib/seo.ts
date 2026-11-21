import type { Metadata } from "next";

export const SITE = "https://spockshop.com";
export const SITE_NAME = "Spock's Resale Shop";
export const SITE_DESCRIPTION = "Spock's Resale Shop: Closet Picks (one-of-a-kind secondhand finds from Bentonville, Arkansas) and Amazon Picks we recommend.";

/** Other CF LLC public sites. Shopper-facing cross-links only; no marketplace profile URLs. */
export const CF_LLC_SITES: { href: string; label: string; blurb: string }[] = [
  { href: "https://cf-llc.github.io", label: "CF LLC websites", blurb: "Websites for small businesses" },
  { href: "https://satoshispath.netlify.app", label: "Satoshi's Path", blurb: "Bitcoin basics for ordinary budgets" },
  { href: "https://saasnation.site", label: "SaaS Nation", blurb: "Simple tools for small businesses" },
];

export function pageSeo(path: string, title: string, description: string, opts?: { absolute?: boolean }): Metadata {
  const url = !path || path === "/" ? SITE : `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
  return {
    title: opts?.absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        "name": SITE_NAME,
        "url": SITE,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Bentonville",
          "addressRegion": "AR",
          "addressCountry": "US",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        "name": SITE_NAME,
        "url": SITE,
        "description": SITE_DESCRIPTION,
        "publisher": { "@id": `${SITE}/#organization` },
        "inLanguage": "en-US",
      },
    ],
  };
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
