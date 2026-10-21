import Link from "next/link";
import { AdminNotice } from "@/components/admin/notice";
import { decodeResults } from "@/lib/depop/results";
import { MAX_LINKS_PER_JOB, MAX_LINKS_PER_SUBMIT } from "@/lib/depop/url";
import { bookmarkletHref } from "@/lib/depop/bookmarklet";
import { BookmarkletButton, BulkImporter } from "./bulk-importer";
import type { LinkResult } from "@/lib/depop/import";

const BADGE: Record<LinkResult["status"], string> = {
  imported: "bg-emerald-100 text-emerald-900",
  duplicate: "bg-amber-100 text-amber-900",
  error: "bg-red-100 text-red-900",
};
const LABEL: Record<LinkResult["status"], string> = { imported: "Imported as draft", duplicate: "Already imported", error: "Not imported" };

export default async function DepopImportPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; r?: string }> }) {
  const sp = await searchParams;
  const results = decodeResults(sp.r);
  const counts = results ? { imported: results.filter((r) => r.status === "imported").length, duplicate: results.filter((r) => r.status === "duplicate").length, error: results.filter((r) => r.status === "error").length } : null;

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/closet" className="inline-flex min-h-[44px] items-center text-sm text-slate-600">← All closet items</Link>
      <h1 className="text-2xl font-semibold">Import from Depop links</h1>
      <p className="text-sm text-slate-600">
        Paste links to <strong>your own</strong> Depop listings, one per line. Each page is fetched once, one at a time,
        and becomes a <strong>draft</strong> Closet Pick that needs approval: title, photos, price, size, condition and description.
        Nothing goes live until you review and publish it. The Depop link is kept internally for duplicate checks and is never shown to shoppers.
      </p>
      <AdminNotice ok={sp.ok} error={sp.error} />

      <section aria-labelledby="bulk-title" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" data-testid="depop-bulk">
        <h2 id="bulk-title" className="text-lg font-semibold">Bulk import your whole Depop shop</h2>
        <BookmarkletButton href={bookmarkletHref()} />
        <p className="text-sm text-slate-600">Drag the button to your bookmarks bar, open depop.com/spock13, click the bookmark, wait while it reads each listing in your browser (about a second each), then paste what it copied below. If you added the bookmark before Oct 20, 2026 evening, delete it and drag this button again.</p>
        <BulkImporter maxLinks={MAX_LINKS_PER_JOB} />
      </section>

      <h2 className="text-lg font-semibold">Or import up to {MAX_LINKS_PER_SUBMIT} links at once</h2>

      {results && counts ? (
        <section aria-labelledby="results-title" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" data-testid="depop-results">
          <h2 id="results-title" className="text-lg font-semibold">Results</h2>
          <p className="text-sm text-slate-700">{counts.imported} imported · {counts.duplicate} already imported · {counts.error} not imported</p>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{LABEL[r.status]}</span>
                  <span className="break-all text-slate-500">{r.input}</span>
                </div>
                {r.status === "imported" ? (
                  <p className="mt-1">
                    <Link href={`/admin/closet/${r.id}`} className="font-semibold text-blue-700 underline">{r.title}</Link>
                    <span className="text-slate-600"> · {r.photos} photo{r.photos === 1 ? "" : "s"}{r.note ? ` · ${r.note}` : ""}</span>
                  </p>
                ) : r.status === "duplicate" ? (
                  <p className="mt-1 text-slate-700">{r.id ? <>Skipped, already a draft or item: <Link href={`/admin/closet/${r.id}`} className="font-semibold text-blue-700 underline">{r.title}</Link></> : r.title}</p>
                ) : (
                  <p className="mt-1 text-red-800">{r.error}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action="/api/admin/depop/import" method="post" className="surface-panel space-y-3 rounded-2xl p-4">
        <label className="block text-sm font-medium" htmlFor="links">Depop listing links</label>
        <textarea id="links" name="links" rows={8} required placeholder={"https://www.depop.com/products/yourname-vintage-nasa-tee/\nhttps://www.depop.com/products/yourname-star-trek-mug/"} className="field-input w-full font-mono text-xs" />
        <p className="text-xs text-slate-500">Only www.depop.com/products/… links. Shop, profile and search pages are rejected. Importing pauses ~2.5 seconds between listings, so 20 links take about a minute.</p>
        <button type="submit" className="btn btn-primary w-full sm:w-auto">Import</button>
      </form>
    </section>
  );
}
