import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/blog/post-body";
import { PostCover, ProductLinks } from "@/components/blog/post-extras";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { blogCanonical } from "@/lib/blog/config";
import { articleJsonLd } from "@/lib/blog/seo";
import { blogPaths } from "@/lib/blog/links";
import { publishedBySlug, picksByIds } from "@/lib/blog/repo";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await publishedBySlug((await params).slug);
  if (!post) return { title: "Post not found", robots: { index: false } };
  const url = blogCanonical(post.slug);
  return {
    title: { absolute: `${post.title} | SpockShop Blog` },
    description: post.description,
    keywords: post.targetKeyword ? [post.targetKeyword] : undefined,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.description, url, type: "article", siteName: "SpockShop Blog", images: post.coverImageUrl ? [post.coverImageUrl] : undefined, publishedTime: post.publishedAt?.toISOString(), modifiedTime: post.updatedAt.toISOString() },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" }).format(d) : "");

export default async function BlogPostPage({ params }: Params) {
  const post = await publishedBySlug((await params).slug);
  if (!post) notFound(); // drafts and rejected posts 404
  const [picks, paths] = await Promise.all([picksByIds(post.affiliateItemIds), blogPaths()]);
  return (
    <article className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(post)).replace(/</g, "\\u003c") }} />
      <p className="mb-4 rounded-lg border border-[var(--line)] p-3 text-sm" data-testid="amazon-disclosure">{AMAZON_ASSOCIATES_DISCLOSURE}</p>
      <Breadcrumbs items={[{ label: "Blog", href: paths.index }, { label: post.title }]} />
      <header className="mb-8 mt-4">
        <p className="t-eyebrow mb-2">{post.kind.replace("_", " ")}</p>
        <h1 className="t-h1">{post.title}</h1>
        <p className="dim mt-2 text-sm">Published <time dateTime={post.publishedAt?.toISOString()}>{fmt(post.publishedAt)}</time></p>
        <p className="muted mt-4">{post.description}</p>
      </header>
      <PostCover url={post.coverImageUrl} title={post.title} />
      <PostBody bodyMd={post.bodyMd} picks={picks} />
      <ProductLinks links={post.productLinks} />
    </article>
  );
}
