import Link from "next/link";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { AffiliateImportForm } from "@/app/admin/affiliate/import/import-form";

export default async function AffiliateImportPage({ searchParams }: { searchParams: NoticeParams }) {
  return (
    <section className="space-y-6">
      <p><Link href="/admin/affiliate" className="text-sm text-blue-700">← Amazon picks</Link></p>
      <h1 className="text-2xl font-semibold">Bulk import Amazon picks</h1>
      <p className="text-sm text-slate-600">
        Paste a JSON array (or upload a .json file). Each pick needs a <code>title</code> and an <code>asin</code> or
        <code> link</code>; optional <code>price</code>, <code>image_url</code>, <code>blurb</code>. Existing picks with the same ASIN or link are
        updated, new ones are added, nothing is deleted. Links are rewritten to carry tag=mrspock-20. Prices are stored as an internal note only and
        are never shown on the site (Amazon Associates compliance); ratings are ignored.
      </p>
      <AdminNotice {...await searchParams} />
      <AffiliateImportForm />
    </section>
  );
}
