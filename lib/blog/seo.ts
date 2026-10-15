import { blogCanonical, blogOrigin } from "./config";

/** Article JSON-LD only: no product, offer or review schema (no prices or ratings). */
export function articleJsonLd(post: { title: string; description: string; slug: string; publishedAt: Date | null; updatedAt: Date; targetKeyword: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: blogCanonical(post.slug),
    url: blogCanonical(post.slug),
    keywords: post.targetKeyword || undefined,
    author: { "@type": "Organization", name: "Spock's Resale Shop", url: "https://spockshop.com" },
    publisher: { "@type": "Organization", name: "Spock's Resale Shop", url: "https://spockshop.com", logo: { "@type": "ImageObject", url: `${blogOrigin()}/icon-512.png` } },
  };
}
