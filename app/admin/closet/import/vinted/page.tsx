import Link from "next/link";
import { AdminNotice } from "@/components/admin/notice";
import { decodeResults } from "@/lib/depop/results";
import { MAX_LINKS_PER_SUBMIT } from "@/lib/depop/url";
import { OWN_MEMBER } from "@/lib/vinted/url";
import { VintedSync } from "./vinted-sync";

const LABEL = { imported: "Imported as draft", duplicate: "Skipped: duplicate", updated: "Updated", sold: "Skipped: sold", error: "Not imported" } as const;

export default async function VintedImportPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; r?: string }> }) {
  const sp = await searchParams;
  const results = decodeResults(sp.r);
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/closet/import" className="inline-flex min-h-[44px] items-center text-sm text-slate-600">← Depop import</Link>
      <h1 className="text-2xl font-semibold">Import from Vinted links</h1>
      <p className="text-sm text-slate-600">
        Paste links to <strong>your own</strong> Vinted items ({OWN_MEMBER}), one per line. Each page is read once, slowly, with no login,
        and becomes a <strong>draft</strong> that needs approval. The Vinted link is kept internally for duplicate checks and is never shown to shoppers.
        If Vinted blocks or challenges the server, the import stops and you can add the item by hand below.
      </p>
      <AdminNotice ok={sp.ok} error={sp.error} />

      {results ? (
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4" data-testid="vinted-results">
          <h2 className="text-lg font-semibold">Results</h2>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                <span className="font-semibold">{LABEL[r.status]}</span> <span className="break-all text-slate-500">{r.input}</span>
                {"id" in r && r.id ? <p className="mt-1"><Link href={`/admin/closet/${r.id}`} className="text-blue-700 underline">{"title" in r ? r.title : "Open item"}</Link>{r.status === "updated" ? ` · ${r.changes.join("; ")}` : ""}</p> : null}
                {r.status === "sold" ? <p className="mt-1 text-slate-700">Already sold on Vinted, no draft made ({r.title})</p> : null}
                {r.status === "duplicate" && !r.id ? <p className="mt-1 text-slate-700">{r.title}</p> : null}
                {r.status === "error" ? <p className="mt-1 text-red-800">{r.error}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action="/api/admin/vinted/import" method="post" className="surface-panel space-y-3 rounded-2xl p-4">
        <label className="block text-sm font-medium" htmlFor="links">Vinted item links (up to {MAX_LINKS_PER_SUBMIT})</label>
        <textarea id="links" name="links" rows={6} required placeholder={"https://www.vinted.com/items/1234567890-star-trek-tee"} className="field-input w-full font-mono text-xs" />
        <p className="text-xs text-slate-500">Only www.vinted.com/items/… links. About 4 seconds between items.</p>
        <button type="submit" className="btn btn-primary w-full sm:w-auto">Import</button>
      </form>

      <section className="surface-panel space-y-3 rounded-2xl p-4" data-testid="vinted-manual">
        <h2 className="text-lg font-semibold">Add by hand (if Vinted blocks the server)</h2>
        <form action="/api/admin/vinted/manual" method="post" encType="multipart/form-data" className="space-y-2">
          <input name="url" required placeholder="Vinted item link" className="field-input w-full font-mono text-xs" />
          <input name="title" required placeholder="Title" className="field-input w-full" />
          <div className="flex gap-2">
            <input name="price" required inputMode="decimal" placeholder="Price (USD)" className="field-input w-1/3" />
            <input name="size" placeholder="Size" className="field-input w-1/3" />
            <input name="condition" placeholder="Condition" className="field-input w-1/3" />
          </div>
          <textarea name="description" rows={3} placeholder="Description" className="field-input w-full" />
          <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="block text-sm" />
          <button type="submit" className="btn btn-primary w-full sm:w-auto">Save as draft</button>
        </form>
      </section>

      <section className="surface-panel space-y-2 rounded-2xl p-4">
        <h2 className="text-lg font-semibold">Sync my Vinted shop</h2>
        <p className="text-sm text-slate-600">Reads only your public member page, once, then each item slowly. New items become drafts, sold ones get marked Sold, nothing is deleted. Runs only when you press the button.</p>
        <VintedSync />
      </section>
    </section>
  );
}
