import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/blog/post-body";
import { AdminNotice } from "@/components/admin/notice";
import { postById, picksByIds } from "@/lib/blog/repo";
import { draftProblems, wordCount } from "@/lib/blog/rules";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/shop/sections";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminBlogPostPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const post = await postById(id);
  if (!post) notFound();
  const picks = await picksByIds(post.affiliateItemIds);
  const problems = draftProblems(post, { knownPickIds: new Set(picks.keys()) });
  const sp = await searchParams;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/blog?tab=${post.status}`} className="text-sm underline">← Blog {post.status}s</Link>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold uppercase">{post.status}</span>
      </div>
      <AdminNotice ok={sp.ok} error={sp.error} />
      {problems.length ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Needs a fix before publishing: {problems.join(" ")}</p> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        {post.status === "draft" ? (
          <form action={`/api/admin/blog/${post.id}`} method="post"><input type="hidden" name="intent" value="approve" /><button className="btn btn-primary w-full" type="submit">Approve &amp; publish</button></form>
        ) : (
          <form action={`/api/admin/blog/${post.id}`} method="post"><input type="hidden" name="intent" value="restore" /><button className="btn btn-outline w-full" type="submit">Back to drafts</button></form>
        )}
        <a href="#edit" className="btn btn-outline text-center">Edit</a>
        {post.status !== "rejected" ? (
          <form action={`/api/admin/blog/${post.id}`} method="post"><input type="hidden" name="intent" value="reject" /><button className="btn btn-outline w-full text-red-700" type="submit">{post.status === "published" ? "Unpublish" : "Reject"}</button></form>
        ) : null}
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 md:p-8" aria-label="Preview">
        <p className="mb-4 rounded-lg border border-slate-200 p-3 text-sm">{AMAZON_ASSOCIATES_DISCLOSURE}</p>
        <p className="text-xs uppercase tracking-wide text-slate-500">{post.kind.replace("_", " ")} · {wordCount(post.bodyMd)} words · keyword “{post.targetKeyword}”</p>
        <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{post.title}</h1>
        <p className="mt-2 text-slate-600">{post.description}</p>
        <div className="mt-6"><PostBody bodyMd={post.bodyMd} picks={picks} /></div>
      </article>

      <form id="edit" action={`/api/admin/blog/${post.id}`} method="post" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Edit</h2>
        <input type="hidden" name="intent" value="save" />
        <label className="block text-sm font-medium">Title<input name="title" defaultValue={post.title} maxLength={110} className="field-input mt-1 w-full" required /></label>
        <label className="block text-sm font-medium">Slug<input name="slug" defaultValue={post.slug} maxLength={80} className="field-input mt-1 w-full" readOnly={post.status === "published"} /></label>
        <label className="block text-sm font-medium">Meta description<textarea name="description" defaultValue={post.description} maxLength={170} rows={2} className="field-input mt-1 w-full" /></label>
        <label className="block text-sm font-medium">Target keyword<input name="targetKeyword" defaultValue={post.targetKeyword} className="field-input mt-1 w-full" /></label>
        <label className="block text-sm font-medium">Body (Markdown; keep picks as [[pick:id]] lines; no prices or ratings)<textarea name="bodyMd" defaultValue={post.bodyMd} rows={22} className="field-input mt-1 w-full font-mono text-xs" /></label>
        <button type="submit" className="btn btn-primary w-full sm:w-auto">Save changes</button>
      </form>
    </section>
  );
}
