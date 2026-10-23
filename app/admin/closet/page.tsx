import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { AdminNotice } from "@/components/admin/notice";
import { db } from "@/lib/db";
import { categories, inventory, photos, productImports, products } from "@/lib/db/schema";
import { mediaUrl } from "@/lib/media";
import { SHOP_SECTIONS } from "@/lib/shop/sections";
import { CLOSET_STATUSES, SORTS, TRASHED, filterRows, parseListQuery } from "@/lib/admin/closet-manage";
import { STATUS_LABEL } from "@/lib/admin/closet-labels";
import { ClosetManager } from "./closet-manager";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminClosetPage({ searchParams }: { searchParams: SP }) {
  const params = await searchParams;
  const q = parseListQuery(params);
  const [all, cats] = await Promise.all([
    db
      .select({
        id: products.id, sku: products.sku, title: products.title, status: products.status, priceCents: products.priceCents,
        categoryId: products.categoryId, updatedAt: products.updatedAt, createdAt: products.createdAt, trashedAt: products.trashedAt,
        onHand: inventory.quantityOnHand, reserved: inventory.quantityReserved,
        photo: sql<string | null>`(select ${photos.storagePath} from ${photos} where ${photos.productId} = ${products.id} order by ${photos.sortOrder}, ${photos.createdAt} limit 1)`,
        imported: sql<boolean>`exists (select 1 from ${productImports} where ${productImports.productId} = ${products.id})`,
      })
      .from(products)
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(eq(products.source, "closet")),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
  ]);
  const rows = all.map((r) => ({ ...r, onHand: r.onHand ?? 0, reserved: r.reserved ?? 0 }));
  const shown = filterRows(rows, q);
  const counts = Object.fromEntries([...CLOSET_STATUSES, TRASHED].map((s) => [s, rows.filter((r) => r.status === s).length]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const here = `/admin/closet?${new URLSearchParams(Object.entries({ q: q.q, status: q.status, source: q.source, category: q.category, sort: q.sort, view: q.trash ? "trash" : "" }).filter(([, v]) => v && v !== "all" && !(v === "updated")) as [string, string][]).toString()}`;
  const tab = (label: string, status: string, n: number) => {
    const active = !q.trash && q.status === status;
    const href = status === "all" ? "/admin/closet" : `/admin/closet?status=${status}`;
    return <Link key={status} href={href} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}>{label} <span className="opacity-70">{n}</span></Link>;
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{SHOP_SECTIONS.closet.title}{q.trash ? " · Trash" : ""}</h1>
          <p className="text-sm text-slate-600">{rows.length - counts[TRASHED]} item{rows.length - counts[TRASHED] === 1 ? "" : "s"} · {counts.listed} live · {counts.draft} drafts{counts[TRASHED] ? ` · ${counts[TRASHED]} in Trash` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/closet/import" className="btn btn-outline">Import from Depop</Link>
          <Link href="/admin/closet/new" className="btn btn-primary">＋ Add item</Link>
        </div>
      </div>
      <AdminNotice ok={one(params.ok)} error={one(params.error)} />
      {one(params.undo) ? (
        <form action="/api/admin/closet/bulk" method="post" className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white p-3 text-sm" data-testid="undo-bar">
          <input type="hidden" name="action" value="restore" />
          <input type="hidden" name="return" value="/admin/closet" />
          {String(one(params.undo)).split(",").slice(0, 500).map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
          <span>Moved to Trash by mistake?</span>
          <button type="submit" className="btn btn-outline px-4 text-sm">↩ Undo</button>
        </form>
      ) : null}

      <nav aria-label="Status" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tab("All", "all", rows.length - counts[TRASHED])}
        {tab("Drafts", "draft", counts.draft)}
        {tab("Live", "listed", counts.listed)}
        {tab("Sold", "sold", counts.sold)}
        {tab("Archived", "archived", counts.archived)}
        <Link href="/admin/closet?view=trash" className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${q.trash ? "border-red-800 bg-red-800 text-white" : "border-slate-300 bg-white"}`}>🗑 Trash <span className="opacity-70">{counts[TRASHED]}</span></Link>
      </nav>

      <form method="get" action="/admin/closet" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" data-testid="closet-filters">
        {q.trash ? <input type="hidden" name="view" value="trash" /> : null}
        <label className="sr-only" htmlFor="closet-q">Search</label>
        <input id="closet-q" name="q" type="search" defaultValue={q.q} placeholder="Search title or SKU  ( / )" className="field-input w-full" data-closet-search />
        {q.trash ? <span className="hidden lg:block" /> : (
          <select name="status" defaultValue={q.status} aria-label="Status" className="field-input">
            <option value="all">Any status</option>
            {CLOSET_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
          </select>
        )}
        <select name="source" defaultValue={q.source} aria-label="Source" className="field-input">
          <option value="all">Any source</option>
          <option value="depop">Imported from Depop</option>
          <option value="manual">Added by hand</option>
        </select>
        <select name="category" defaultValue={q.category} aria-label="Category" className="field-input">
          <option value="all">Any category</option>
          <option value="none">No category</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="sort" defaultValue={q.sort} aria-label="Sort" className="field-input">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">Apply</button>
          <Link href={q.trash ? "/admin/closet?view=trash" : "/admin/closet"} className="btn btn-outline">Reset</Link>
        </div>
      </form>

      <ClosetManager
        trash={q.trash}
        returnTo={here}
        total={rows.length}
        rows={shown.map((r) => ({
          id: r.id, sku: r.sku, title: r.title, status: r.status, priceCents: r.priceCents, onHand: r.onHand, reserved: r.reserved,
          imported: r.imported, category: r.categoryId ? catName.get(r.categoryId) ?? null : null,
          photo: r.photo ? mediaUrl(r.photo) : null, updated: r.updatedAt.toISOString(), trashedAt: r.trashedAt?.toISOString() ?? null,
        }))}
      />
    </section>
  );
}
