import Link from "next/link";
import { AdminNotice } from "@/components/admin/notice";
import { aiAvailable, aiConfig } from "@/lib/ai/config";
import { blogCanonical, draftsPerWeek } from "@/lib/blog/config";
import { postsByStatus, statusCounts } from "@/lib/blog/repo";
import { draftProblems, wordCount } from "@/lib/blog/rules";
import type { BlogPostStatus } from "@/lib/db/schema";

const TABS: [BlogPostStatus, string][] = [["draft", "Drafts"], ["published", "Published"], ["rejected", "Rejected"]];
const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d) + " CT" : "—");

type Props = { searchParams: Promise<{ tab?: string; ok?: string; error?: string }> };

export default async function AdminBlogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = (TABS.find(([t]) => t === sp.tab)?.[0] ?? "draft") as BlogPostStatus;
  const [rows, counts] = await Promise.all([postsByStatus(tab), statusCounts()]);
  const perWeek = draftsPerWeek();
  const ai = aiConfig();

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Blog</h1>
          <p className="text-sm text-slate-600">
            AI writes drafts; nothing goes live until you tap Approve. {perWeek ? `Auto-drafts: up to ${perWeek}/week` : "Auto-drafts are off (BLOG_DRAFTS_PER_WEEK=0)"} · {ai.provider}:{ai.model} · <a className="underline" href={blogCanonical()} target="_blank" rel="noopener">blog.spockshop.com</a>
          </p>
        </div>
        <form action="/api/admin/blog" method="post">
          <input type="hidden" name="intent" value="generate" />
          <button type="submit" className="btn btn-primary" disabled={!aiAvailable()} data-testid="generate">Generate draft</button>
        </form>
      </div>
      <AdminNotice ok={sp.ok} error={sp.error} />

      <nav aria-label="Blog status" className="tabs">
        {TABS.map(([t, label]) => (
          <Link key={t} href={`/admin/blog?tab=${t}`} aria-current={t === tab ? "page" : undefined} className="tab">
            {label} <span className="count">{counts[t]}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">{tab === "draft" ? "No drafts waiting. Tap Generate draft to write one now." : "Nothing here yet."}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" data-testid="blog-queue">
          {rows.map((p) => {
            const problems = tab === "draft" ? draftProblems(p) : [];
            return (
              <li key={p.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" data-testid="blog-card">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{p.kind.replace("_", " ")} · {wordCount(p.bodyMd)} words · {p.affiliateItemIds.length} picks · {when(tab === "published" ? p.publishedAt : p.createdAt)}</p>
                  <h2 className="text-base font-semibold leading-snug"><Link className="hover:underline" href={`/admin/blog/${p.id}`}>{p.title}</Link></h2>
                  <p className="text-sm text-slate-600">{p.description}</p>
                  <p className="text-xs text-slate-500">Keyword: <span className="font-medium text-slate-700">{p.targetKeyword}</span> · /{p.slug}</p>
                  {problems.length ? <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Needs a fix before publishing: {problems.join(" ")}</p> : null}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {tab === "draft" ? (
                    <form action={`/api/admin/blog/${p.id}`} method="post" className="col-span-2 sm:col-span-1">
                      <input type="hidden" name="intent" value="approve" />
                      <button type="submit" className="btn btn-primary w-full" data-testid="approve">Approve &amp; publish</button>
                    </form>
                  ) : tab === "published" ? (
                    <a className="btn btn-outline col-span-2 sm:col-span-1" href={blogCanonical(p.slug)} target="_blank" rel="noopener">View live</a>
                  ) : (
                    <form action={`/api/admin/blog/${p.id}`} method="post" className="col-span-2 sm:col-span-1">
                      <input type="hidden" name="intent" value="restore" />
                      <button type="submit" className="btn btn-outline w-full">Back to drafts</button>
                    </form>
                  )}
                  <Link href={`/admin/blog/${p.id}`} className="btn btn-outline text-center">Preview / Edit</Link>
                  {tab !== "rejected" ? (
                    <form action={`/api/admin/blog/${p.id}`} method="post">
                      <input type="hidden" name="intent" value="reject" />
                      <button type="submit" className="btn btn-outline w-full text-red-700" data-testid="reject">{tab === "published" ? "Unpublish" : "Reject"}</button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
