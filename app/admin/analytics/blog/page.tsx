import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { topBy, totals, trend, viewsPerPath } from "@/lib/analytics/report";
import { AnalyticsTabs, Stat, TopList, TrendChart } from "@/components/admin/analytics/charts";

export const dynamic = "force-dynamic";
const NOT_POSTS = new Set(["/blog", "/blog/", "/blog/rss.xml", "/blog/sitemap.xml", "/blog/robots.txt"]);

export default async function BlogAnalyticsPage() {
  const [t7, t30, tAll, points, perPath, refs, terms, posts] = await Promise.all([
    totals(db, 7, "/blog"), totals(db, 30, "/blog"), totals(db, null, "/blog"), trend(db, 30, "/blog"),
    viewsPerPath(db, "/blog"), topBy(db, "source", { days: 30, prefix: "/blog" }), topBy(db, "term", { days: 90, prefix: "/blog" }),
    db.execute(sql`select slug, title, status from blog_posts`) as unknown as Promise<{ slug: string; title: string; status: string }[]>,
  ]);
  const bySlug = new Map((posts as { slug: string; title: string; status: string }[]).map((p) => [p.slug, p]));
  const rows = perPath.filter((r) => !NOT_POSTS.has(r.path)).map((r) => {
    const slug = r.path.replace(/^\/blog\//, "").replace(/\/$/, "");
    return { ...r, slug, post: bySlug.get(slug) };
  });
  const index = perPath.find((r) => r.path === "/blog");
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold">Blog analytics</h1>
      <AnalyticsTabs active="blog" />
      <div className="grid grid-cols-3 gap-3" data-testid="blog-stats">
        <Stat label="Blog views 7 days" value={t7.views} sub={`${t7.visitors} visitors`} />
        <Stat label="30 days" value={t30.views} sub={`${t30.visitors} visitors`} />
        <Stat label="All time" value={tAll.views} sub={`${tAll.visitors} visitors`} />
      </div>
      <TrendChart points={points} label="Daily blog views, last 30 days" />
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white" data-testid="blog-posts-table">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-600"><th className="p-3">Post</th><th className="p-3 text-right">7d</th><th className="p-3 text-right">30d</th><th className="p-3 text-right">All</th></tr></thead>
          <tbody>
            {index ? <tr className="border-t border-slate-100"><td className="p-3 text-slate-600">Blog home</td><td className="p-3 text-right">{index.d7}</td><td className="p-3 text-right">{index.d30}</td><td className="p-3 text-right font-semibold">{index.all}</td></tr> : null}
            {rows.length ? rows.map((r) => (
              <tr key={r.path} className="border-t border-slate-100">
                <td className="p-3">{r.post ? <Link href={`/blog/${r.slug}`} className="text-blue-700 underline">{r.post.title}</Link> : <span className="break-all">{r.path}</span>}{r.post && r.post.status !== "published" ? <span className="ml-1 text-xs text-amber-700">({r.post.status})</span> : null}</td>
                <td className="p-3 text-right">{r.d7}</td><td className="p-3 text-right">{r.d30}</td><td className="p-3 text-right font-semibold">{r.all}</td>
              </tr>
            )) : <tr><td colSpan={4} className="p-3 text-slate-600">No post views counted yet. Counting started with this update; views appear as readers arrive.</td></tr>}
          </tbody>
        </table>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <TopList title="Top posts (30 days)" rows={rows.filter((r) => r.d30 > 0).sort((a, b) => b.d30 - a.d30).slice(0, 10).map((r) => ({ key: r.post?.title ?? r.path, n: r.d30 }))} />
        <TopList title="Referrers to the blog (30 days)" rows={refs} empty="No external referrers yet." />
        <TopList title="Search terms (90 days)" rows={terms} testId="blog-terms" empty="Not available: search engines (Google, Bing) don't pass the search term to websites, so only the rare referrer that includes a query shows here. Google Search Console is the place for real search terms." />
      </div>
    </section>
  );
}
