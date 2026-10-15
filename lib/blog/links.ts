import { headers } from "next/headers";
import { blogHost } from "./config";
import { hostOf } from "./host";

/** Paths for in-blog links: "/<slug>" on blog.spockshop.com, "/blog/<slug>" on the main host (and local dev). */
export async function blogPaths() {
  const onBlogHost = hostOf(await headers()) === blogHost();
  const base = onBlogHost ? "" : "/blog";
  return { index: base || "/", post: (slug: string) => `${base}/${slug}`, page: (n: number) => (n <= 1 ? base || "/" : `${base || "/"}?page=${n}`) };
}
