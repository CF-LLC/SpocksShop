import { asc } from "drizzle-orm";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { ClosetForm } from "@/components/admin/closet-form";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";

export default async function NewClosetItemPage({ searchParams }: { searchParams: NoticeParams }) {
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">New closet item</h1>
      <AdminNotice {...await searchParams} />
      <ClosetForm action="/api/admin/closet" categories={cats} submitLabel="Create item, then add photos" isNew />
    </section>
  );
}
