"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AffiliateShopPreview } from "@/components/admin/affiliate-preview";
import { AffiliateLink } from "@/components/shop/affiliate-link";
import { AFFILIATE_CATEGORIES } from "@/lib/affiliate/categories";
import { catalogCounts, filterAffiliateItems, missingCopy, missingCopyLabel, moveId, moveIdTo, parseAmazonPaste } from "@/lib/admin/affiliate-catalog";
import { affiliateUrlFor } from "@/lib/commerce/affiliate";
import { fallbackWhy } from "@/lib/shop/daily-pick-core";

export type AffiliateCatalogItem = {
  id: string;
  title: string;
  fullTitle: string | null;
  blurb: string | null;
  why: string | null;
  imageUrl: string | null;
  amazonUrl: string | null;
  asin: string | null;
  priceNote: string | null;
  category: string | null;
  active: boolean;
  sortOrder: number;
  clicks: { n: number; d7: number; d30: number };
};

export type DailyPickInfo = { id: string; title: string; why: string; date: string; locked: boolean } | null;

type Props = {
  items: AffiliateCatalogItem[];
  totals: { n: number; d7: number; d30: number };
  unattributed: { n: number; d7: number; d30: number };
  daily: { day: string; n: number }[];
  today: DailyPickInfo;
  tomorrow: DailyPickInfo;
  nextSortOrder: number;
};

const catLabel = (slug: string | null) => AFFILIATE_CATEGORIES.find((c) => c.slug === slug)?.label ?? "No category";

function weekday(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function prettyDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function AffiliateCatalog({ items, totals, unattributed, daily, today, tomorrow, nextSortOrder }: Props) {
  const router = useRouter();
  const serverKey = items.map((item) => `${item.id}:${item.sortOrder}`).join("|");
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  const [known, setKnown] = useState(serverKey);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<"all" | "live" | "hidden">("all");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (known !== serverKey) {
    setKnown(serverKey);
    setOrder(items.map((item) => item.id));
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  for (const item of items) if (!ordered.some((row) => row.id === item.id)) ordered.push(item);

  const counts = catalogCounts(items);
  const filtering = q.trim() !== "" || category !== "all" || status !== "all";
  const canReorder = !filtering && !saving;
  const shown = filterAffiliateItems(ordered, { q, category, status });
  const editorItem = editing && editing !== "new" ? byId.get(editing) ?? null : null;
  const closeEditor = useCallback(() => setEditing(null), []);

  async function commit(next: readonly string[]) {
    if (next === order || next.join("|") === order.join("|")) return;
    const prev = order;
    setOrder([...next]);
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      next.forEach((id) => body.append("ids", id));
      const res = await fetch("/api/admin/affiliate/reorder", { method: "POST", body, headers: { accept: "application/json" } });
      const redirectedError = res.redirected ? new URL(res.url).searchParams.get("error") : null;
      if (!res.ok || redirectedError) {
        setOrder(prev);
        setError(redirectedError || "Couldn't save the new order.");
        return;
      }
      router.refresh();
    } catch {
      setOrder(prev);
      setError("Couldn't save the new order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="affiliate-catalog">
      <aside className="surface-panel space-y-2 rounded-2xl p-4 text-sm" data-testid="affiliate-daily-pick">
        <h2 className="font-semibold">Daily Pick</h2>
        <p className="text-slate-600">
          Rotates on its own at midnight CT, in a fixed cycle. The Why field is the line shoppers see when that product comes up.
          This page does not pin a different product onto today or tomorrow, because that would change the cycle.
          A day locks the first time the shop is viewed. Hiding today&apos;s pick lets the rotation choose another active one.
        </p>
        {today ? (
          <p>
            {today.locked ? "Today" : "Today is not locked yet. The cycle would choose"}, {prettyDate(today.date)}:{" "}
            <button type="button" className="btn-text" onClick={() => setEditing(today.id)}>{today.title}</button>
            <span className="text-slate-600"> — {today.why}</span>
          </p>
        ) : <p className="text-slate-600">No pick for today yet. Active picks join the rotation automatically.</p>}
        {tomorrow ? (
          <p>
            {tomorrow.locked ? "Tomorrow" : "Tomorrow is not locked yet. The cycle would choose"}, {prettyDate(tomorrow.date)}:{" "}
            <button type="button" className="btn-text" onClick={() => setEditing(tomorrow.id)}>{tomorrow.title}</button>
            <span className="text-slate-600"> — {tomorrow.why}</span>
          </p>
        ) : null}
        <p><Link href="/picks" className="btn-text text-sm">View the public picks page</Link></p>
      </aside>

      <div className="space-y-2" data-testid="affiliate-click-totals">
        <p className="text-sm text-slate-700">
          Outbound clicks: <strong>{totals.d7}</strong> in 7 days · <strong>{totals.d30}</strong> in 30 days · <strong>{totals.n}</strong> on record (about 90 days of detail).
          Amazon reports sales. This counts only clicks that left our site, from the existing click beacon. Signed-in admin visits are not counted.
          {unattributed.n > 0 ? ` ${unattributed.n} had no ASIN and are not on a card.` : ""}
        </p>
        <ol className="flex gap-2 overflow-x-auto text-xs" aria-label="Outbound clicks by day, America/Chicago">
          {daily.map((day) => (
            <li key={day.day} className="min-w-12 rounded-lg bg-slate-100 px-2 py-1 text-center">
              <span className="block text-slate-500">{weekday(day.day)}</span>
              <span className="font-semibold text-slate-900">{day.n}</span>
            </li>
          ))}
        </ol>
        <p><Link href="/admin/analytics" className="text-sm text-blue-700">Open analytics</Link></p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_10rem_auto] lg:items-end">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, ASIN, or blurb" className="field-input" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input">
            <option value="all">All categories</option>
            {AFFILIATE_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            <option value="none">No category</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as "all" | "live" | "hidden")} className="field-input">
            <option value="all">Active and hidden</option>
            <option value="live">Active</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>Add a pick</button>
      </div>

      <p className="text-sm text-slate-700" aria-live="polite">
        <strong>{counts.live}</strong> live · <strong>{counts.hidden}</strong> hidden · {shown.length} shown
        {saving ? " · Saving order…" : ""}
      </p>
      <p className="text-xs text-slate-500">{canReorder ? "Drag a handle or use the arrows. This is the order on the Amazon Picks shelf. Daily Pick still rotates on its own." : "Clear search and filters to reorder."}</p>
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">{items.length ? "Nothing matches these filters." : "No Amazon picks yet."}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" data-testid="affiliate-list" aria-label="Amazon picks">
          {shown.map((item) => {
            const index = ordered.findIndex((row) => row.id === item.id);
            const gap = missingCopyLabel(missingCopy(item));
            return (
              <li
                key={item.id}
                data-testid="affiliate-card"
                onDragOver={(e) => { if (canReorder) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  setDragId(null);
                  if (canReorder && id) void commit(moveIdTo(order, id, index));
                }}
                className={`flex gap-2 rounded-2xl border bg-white p-2 sm:gap-3 sm:p-3 ${gap ? "border-amber-400 bg-amber-50" : "border-slate-200"} ${item.active ? "" : "opacity-80"} ${dragId === item.id ? "opacity-50" : ""}`}
              >
                <div className="flex flex-col">
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-lg text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40" aria-label={`Move ${item.title} earlier`} disabled={!canReorder || index <= 0} onClick={() => void commit(moveId(order, item.id, "up"))}>↑</button>
                  <div
                    role="button"
                    tabIndex={canReorder ? 0 : -1}
                    aria-disabled={!canReorder}
                    aria-label={`Drag to reorder ${item.title}. Arrow keys also move it.`}
                    draggable={canReorder}
                    className={`grid h-11 w-11 place-items-center rounded-lg text-slate-500 ${canReorder ? "cursor-grab hover:bg-slate-100" : "cursor-not-allowed opacity-40"}`}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; setDragId(item.id); }}
                    onDragEnd={() => setDragId(null)}
                    onKeyDown={(e) => {
                      if (!canReorder) return;
                      if (e.key === "ArrowUp") { e.preventDefault(); void commit(moveId(order, item.id, "up")); }
                      if (e.key === "ArrowDown") { e.preventDefault(); void commit(moveId(order, item.id, "down")); }
                    }}
                  >⋮⋮</div>
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-lg text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40" aria-label={`Move ${item.title} later`} disabled={!canReorder || index < 0 || index >= ordered.length - 1} onClick={() => void commit(moveId(order, item.id, "down"))}>↓</button>
                </div>
                <button type="button" onClick={() => setEditing(item.id)} className="shrink-0" aria-label={`Edit ${item.title}`}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote product photo
                    <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg bg-white object-contain sm:h-20 sm:w-20" />
                  ) : <span className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-500 sm:h-20 sm:w-20">No image</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => setEditing(item.id)} className="line-clamp-2 text-left font-semibold text-slate-900 hover:underline">{item.title}</button>
                  {item.fullTitle && item.fullTitle !== item.title ? <p className="line-clamp-1 text-xs text-slate-500">{item.fullTitle}</p> : null}
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="chip">{catLabel(item.category)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{item.active ? "Active" : "Hidden"}</span>
                    {item.id === today?.id ? <span className="chip chip-gold">Today</span> : null}
                    {item.id === tomorrow?.id ? <span className="chip">Tomorrow</span> : null}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-600">{item.asin ?? "No ASIN"}</p>
                  <p className="text-xs text-slate-600" data-testid="affiliate-clicks">
                    {item.clicks.n === 0 ? "No outbound clicks yet" : `${item.clicks.n} outbound ${item.clicks.n === 1 ? "click" : "clicks"}`}
                    {" · "}{item.clicks.d7} in 7 days
                  </p>
                  {gap ? <p className="mt-1 text-xs font-semibold text-amber-800" data-testid="affiliate-needs-copy">{gap}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing === "new" || editorItem ? (
        <Editor
          key={editing ?? "closed"}
          mode={editing === "new" ? "new" : "edit"}
          item={editorItem}
          nextSortOrder={nextSortOrder}
          todayId={today?.id ?? null}
          onClose={closeEditor}
        />
      ) : null}
    </div>
  );
}

function Editor({
  mode,
  item,
  nextSortOrder,
  todayId,
  onClose,
}: {
  mode: "new" | "edit";
  item: AffiliateCatalogItem | null;
  nextSortOrder: number;
  todayId: string | null;
  onClose: () => void;
}) {
  const first = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [title, setTitle] = useState(item?.title ?? "");
  const [fullTitle, setFullTitle] = useState(item?.fullTitle ?? "");
  const [blurb, setBlurb] = useState(item?.blurb ?? "");
  const [why, setWhy] = useState(item?.why ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [amazonUrl, setAmazonUrl] = useState(item?.amazonUrl ?? "");
  const [asin, setAsin] = useState(item?.asin ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [priceNote, setPriceNote] = useState(item?.priceNote ?? "");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  const parsedPaste = parseAmazonPaste(paste);
  const pasteDone = paste.trim().length > 12 || (/amazon\.|amzn\./i.test(paste) && paste.trim().length > 8);
  let href: string | null = null;
  try { href = affiliateUrlFor({ amazonUrl: amazonUrl || null, asin: asin || null }); } catch { href = null; }
  const shopperWhy = why.trim() || (title.trim() ? fallbackWhy(title.trim(), category || null) : "");
  const action = mode === "new" ? "/api/admin/affiliate" : `/api/admin/affiliate/${item?.id ?? ""}`;

  function onPaste(value: string) {
    setPaste(value);
    const parsed = parseAmazonPaste(value);
    if (!parsed) return;
    if (parsed.asin) setAsin(parsed.asin);
    setAmazonUrl(parsed.amazonUrl);
  }

  async function copyLink() {
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button type="button" className="overlay" aria-label="Close editor" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="affiliate-editor-title" className="drawer bg-white text-slate-900" data-testid="affiliate-editor">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id="affiliate-editor-title" className="text-lg font-semibold">{mode === "new" ? "Add a pick" : "Edit pick"}</h2>
          <button type="button" className="btn btn-outline px-3" onClick={onClose}>Close</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <form action={action} method="post" className="space-y-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Paste an Amazon link or ASIN
              <input ref={first} value={paste} onChange={(e) => onPaste(e.target.value)} placeholder="https://www.amazon.com/dp/… or B0ABC12345" autoComplete="off" spellCheck={false} className="field-input" />
            </label>
            {parsedPaste ? <p className="text-xs text-slate-600">Filled the ASIN and the tagged link (tag=mrspock-20).{parsedPaste.asin ? ` ASIN ${parsedPaste.asin}.` : ""}</p> : null}
            {pasteDone && !parsedPaste ? <p className="text-xs text-amber-800">That doesn&apos;t look like an Amazon link or a 10-character ASIN. You can still type them below.</p> : null}

            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Title
              <input name="title" required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Full title
              <input name="fullTitle" maxLength={500} value={fullTitle} onChange={(e) => setFullTitle(e.target.value)} placeholder="Optional longer Amazon title" className="field-input" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Image URL
              <input name="imageUrl" type="url" maxLength={2000} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://" className="field-input" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Blurb
              <textarea name="blurb" maxLength={300} rows={3} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Shown on the public card" className="field-input" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Why it&apos;s a Daily Pick
              <textarea name="why" maxLength={500} rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Used when this product is the daily pick" className="field-input" />
            </label>
            {shopperWhy ? <p className="text-xs text-slate-600">Shoppers see: {shopperWhy}</p> : null}

            <AffiliateShopPreview item={{ title, imageUrl, blurb, amazonUrl, asin }} />

            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Category
              <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="field-input">
                <option value="">No category (All only)</option>
                {AFFILIATE_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active on the shop
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              ASIN
              <input name="asin" value={asin} onChange={(e) => setAsin(e.target.value.toUpperCase())} maxLength={10} autoComplete="off" spellCheck={false} className="field-input font-mono" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Amazon URL
              <input name="amazonUrl" type="url" maxLength={2000} value={amazonUrl} onChange={(e) => setAmazonUrl(e.target.value)} autoComplete="off" className="field-input" />
            </label>
            <p className="text-xs text-slate-500">A pick needs an ASIN or an Amazon URL. Saved Amazon links are rewritten to tag=mrspock-20.</p>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Internal price note
              <input name="priceNote" maxLength={4000} value={priceNote} onChange={(e) => setPriceNote(e.target.value)} title="Stored for reference only. Not shown on the site (Amazon Associates compliance)." className="field-input" />
            </label>
            <p className="text-xs text-slate-500">For your notes only. It is not shown on the shop, in the preview, or anywhere public.</p>
            {mode === "new" ? <input type="hidden" name="sortOrder" value={nextSortOrder} /> : null}
            <button type="submit" name="intent" value="save" className="btn btn-primary">Save</button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-outline" disabled={!href} onClick={() => void copyLink()}>{copied ? "Copied" : "Copy link"}</button>
            {href ? <AffiliateLink item={{ amazonUrl, asin }} className="btn-text text-sm">Test link ↗</AffiliateLink> : <span className="text-xs text-slate-500">Add a URL or ASIN to test the link.</span>}
          </div>

          {mode === "edit" && item ? (
            confirmDelete ? (
              <form action={action} method="post" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3" data-testid="affiliate-delete-confirm">
                <p className="text-sm text-red-900">Delete “{item.title}” permanently? Hiding keeps the pick and its click counts.</p>
                {item.id === todayId ? <p className="text-sm text-red-900">This is today&apos;s Daily Pick. Hiding it lets the rotation choose another active pick for the rest of today.</p> : null}
                <input type="hidden" name="confirm" value="yes" />
                <div className="flex flex-wrap gap-2">
                  {item.active ? <button type="submit" name="intent" value="hide" className="btn btn-outline">Hide instead</button> : null}
                  <button type="submit" name="intent" value="delete" className="btn border-red-700 bg-red-700 text-white">Delete permanently</button>
                  <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                {item.active ? (
                  <form action={action} method="post">
                    <button type="submit" name="intent" value="hide" className="btn btn-outline">Hide</button>
                  </form>
                ) : <p className="text-sm text-slate-600">Hidden. Turn Active on and save to show it again.</p>}
                <button type="button" className="btn border-red-700 text-red-700" onClick={() => setConfirmDelete(true)}>Delete</button>
              </div>
            )
          ) : null}
        </div>
      </div>
    </>
  );
}
