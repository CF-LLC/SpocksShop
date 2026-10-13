import Link from "next/link";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";

const EXAMPLE = `[
  { "title": "Spock rubber duck", "asin": "B0D9NS9RT5", "price": "$12.24", "image_url": "https://m.media-amazon.com/images/I/....jpg" }
]`;

export default async function AffiliateImportPage({ searchParams }: { searchParams: NoticeParams }) {
  return (
    <section className="space-y-6">
      <p><Link href="/admin/affiliate" className="text-sm text-blue-700">← Amazon picks</Link></p>
      <h1 className="text-2xl font-semibold">Bulk import Amazon picks</h1>
      <p className="text-sm text-slate-600">
        Paste a JSON array (or upload a .json file). Each pick needs a <code>title</code> and an <code>asin</code> or
        <code> link</code>; optional <code>price</code>, <code>image_url</code>. Existing picks with the same ASIN or link are
        updated, new ones are added, nothing is deleted. Links are rewritten to carry tag=mrspock-20, and prices are shown
        as &ldquo;About $X, price may vary on Amazon&rdquo;.
      </p>
      <AdminNotice {...await searchParams} />
      <form action="/api/admin/affiliate/import" method="post" encType="multipart/form-data" className="surface-panel space-y-3 rounded-2xl p-4">
        <textarea name="json" rows={14} placeholder={EXAMPLE} className="field-input w-full font-mono text-xs" />
        <input type="file" name="file" accept="application/json,.json" className="text-sm" />
        <div className="flex gap-3">
          <button type="submit" name="intent" value="preview" className="btn btn-outline">Preview</button>
          <button type="submit" name="intent" value="import" className="btn btn-primary">Import</button>
        </div>
      </form>
    </section>
  );
}
