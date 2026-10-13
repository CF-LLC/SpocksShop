import Link from "next/link";
import { asc } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { ClosetForm } from "@/components/admin/closet-form";
import { NewListing } from "@/components/admin/new-listing";
import { aiAvailable } from "@/lib/ai/config";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { MAX_PHOTOS_PER_PRODUCT } from "@/lib/media";

export default async function NewClosetItemPage({ searchParams }: { searchParams: Promise<Awaited<NoticeParams> & { classic?: string }> }) {
  const params = await searchParams;
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">New closet item</h1>
      <AdminNotice {...params} />
      {params.classic ? (
        <>
          <ClosetForm action="/api/admin/closet" categories={cats} submitLabel="Create item, then add photos" isNew />
          <Link href="/admin/closet/new" className="btn-text text-sm">Use the photo-first flow</Link>
        </>
      ) : (
        <>
          {/* Only a boolean crosses to the client; the key stays server-side. */}
          <NewListing aiEnabled={aiAvailable()} maxPhotos={MAX_PHOTOS_PER_PRODUCT} categories={cats} />
          <Link href="/admin/closet/new?classic=1" className="btn-text text-sm">No photos yet? Use the classic form</Link>
        </>
      )}
    </section>
  );
}
