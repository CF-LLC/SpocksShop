"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/admin/closet-labels";

export type ManagerRow = {
  id: string; sku: string; title: string; status: string; priceCents: number; onHand: number; reserved: number;
  imported: boolean; category: string | null; photo: string | null; updated: string; trashedAt: string | null;
};

type Action = "publish" | "unpublish" | "archive" | "mark_sold" | "trash" | "restore" | "purge";
const VERB: Record<Action, string> = { publish: "Publish", unpublish: "Unpublish", archive: "Archive", mark_sold: "Mark sold", trash: "Move to Trash", restore: "Restore", purge: "Delete forever" };
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Post a hidden form (keeps the plain form-post + redirect flow the rest of the admin uses). */
function submit(action: Action, ids: string[], returnTo: string, extra: Record<string, string> = {}) {
  const f = document.createElement("form");
  f.method = "post"; f.action = "/api/admin/closet/bulk";
  const add = (n: string, v: string) => { const i = document.createElement("input"); i.type = "hidden"; i.name = n; i.value = v; f.appendChild(i); };
  add("action", action); add("return", returnTo);
  ids.forEach((id) => add("ids", id));
  Object.entries(extra).forEach(([k, v]) => add(k, v));
  document.body.appendChild(f); f.submit();
}

export function ClosetManager({ rows, trash, returnTo, total }: { rows: ManagerRow[]; trash: boolean; returnTo: string; total: number }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ action: Action; ids: string[]; all?: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const selected = ids.filter((id) => sel.has(id));
  const allOn = selected.length > 0 && selected.length === ids.length;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const run = useCallback((action: Action, list: string[], all = false) => {
    if (!list.length && !all) return;
    // Anything that hides, removes or deletes asks first.
    if (action === "trash" || action === "purge" || action === "archive" || action === "mark_sold") setConfirm({ action, ids: list, all });
    else submit(action, list, returnTo);
  }, [returnTo]);

  useEffect(() => { if (confirm) dialog.current?.showModal(); else dialog.current?.close(); }, [confirm]);

  // Keyboard: / search · a select all · Esc clear · p publish · u unpublish · s sold · Delete/Backspace trash.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (confirm || e.metaKey || e.ctrlKey || e.altKey || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "checkbox")) {
        if (e.key === "Escape" && t.tagName === "INPUT" && t.hasAttribute("data-closet-search")) t.blur();
        return;
      }
      if (e.key === "/") { e.preventDefault(); (document.querySelector("[data-closet-search]") as HTMLInputElement | null)?.focus(); return; }
      if (e.key === "a") { e.preventDefault(); setSel(allOn ? new Set() : new Set(ids)); return; }
      if (e.key === "Escape") { setSel(new Set()); return; }
      if (!selected.length) return;
      const map: Record<string, Action> = trash ? { r: "restore" } : { p: "publish", u: "unpublish", s: "mark_sold", Delete: "trash", Backspace: "trash" };
      const act = map[e.key];
      if (act) { e.preventDefault(); run(act, selected); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allOn, confirm, ids, run, selected, trash]);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center" data-testid="closet-empty">
        <p className="text-4xl" aria-hidden>{trash ? "🗑" : "📦"}</p>
        <p className="mt-2 font-semibold">{trash ? "Trash is empty" : total ? "Nothing matches these filters" : "No closet items yet"}</p>
        {!trash && !total ? <Link href="/admin/closet/new" className="btn btn-primary mt-4">＋ Add item</Link> : null}
      </div>
    );
  }

  const bulkButtons: Action[] = trash ? ["restore", "purge"] : ["publish", "unpublish", "mark_sold", "archive", "trash"];

  return (
    <div className="space-y-3 pb-40 sm:pb-0">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 text-sm" data-testid="bulk-bar">
        <label className="flex min-h-[44px] items-center gap-2 px-2">
          <input type="checkbox" className="h-5 w-5" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(ids))} aria-label="Select all shown" />
          <span>{selected.length ? `${selected.length} selected` : `${rows.length} shown`}</span>
        </label>
        <div className="hidden flex-wrap gap-2 sm:flex">
          {bulkButtons.map((a) => (
            <button key={a} type="button" disabled={!selected.length} onClick={() => run(a, selected)}
              className={`btn px-3 text-sm ${a === "trash" || a === "purge" ? "border-red-700 text-red-700" : "btn-outline"} disabled:opacity-40`}>{VERB[a]}</button>
          ))}
        </div>
        {trash ? <button type="button" onClick={() => run("purge", [], true)} className="btn ml-auto border-red-700 bg-red-700 px-3 text-sm text-white">Empty trash</button> : null}
        <p className="hidden w-full px-2 text-xs text-slate-500 lg:block">Keys: <kbd>/</kbd> search · <kbd>a</kbd> select all · <kbd>Esc</kbd> clear · {trash ? <><kbd>r</kbd> restore</> : <><kbd>p</kbd> publish · <kbd>u</kbd> unpublish · <kbd>s</kbd> mark sold · <kbd>Delete</kbd> trash</>}</p>
      </div>

      <ul className="space-y-2" data-testid="admin-product-list">
        {rows.map((r) => {
          const on = sel.has(r.id);
          return (
            <li key={r.id} className={`rounded-2xl border bg-white p-2 sm:p-3 ${on ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"}`} data-testid="closet-row">
              <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                <label className="grid min-h-[44px] min-w-[36px] place-items-center">
                  <input type="checkbox" className="h-5 w-5" checked={on} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} />
                </label>
                <Link href={`/admin/closet/${r.id}`} className="shrink-0" aria-label={`Open ${r.title}`} tabIndex={-1}>
                  {r.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="" className="checker h-16 w-16 rounded-xl object-contain sm:h-14 sm:w-14" />
                  ) : <span className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100 text-[10px] text-slate-500 sm:h-14 sm:w-14">No photo</span>}
                </Link>
                <div className="min-w-0 flex-1">
                  {editing === r.id ? (
                    <form action={`/api/admin/closet/${r.id}`} method="post" className="flex flex-wrap items-center gap-2" data-testid="inline-edit">
                      <input type="hidden" name="intent" value="quick" />
                      <input type="hidden" name="return" value={returnTo} />
                      <input name="title" defaultValue={r.title} aria-label="Title" className="field-input min-w-0 flex-1" required minLength={2} maxLength={160} autoFocus />
                      <input name="price" defaultValue={(r.priceCents / 100).toFixed(2)} aria-label="Price" inputMode="decimal" className="field-input w-24" />
                      <button type="submit" className="btn btn-primary px-3 text-sm">Save</button>
                      <button type="button" onClick={() => setEditing(null)} className="btn btn-outline px-3 text-sm">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <Link href={`/admin/closet/${r.id}`} className="line-clamp-2 font-semibold text-slate-900 hover:underline">{r.title}</Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                        <span className="text-sm font-semibold text-slate-900">{money(r.priceCents)}</span>
                        <span>qty {r.onHand}</span>
                        {r.category ? <span>· {r.category}</span> : null}
                        <span>· {r.imported ? "Depop" : "Manual"}</span>
                        <span className="hidden sm:inline">· {r.sku}</span>
                      </p>
                    </>
                  )}
                </div>
                {editing === r.id ? null : (
                  <div className="hidden shrink-0 items-center gap-1 sm:flex">
                    {trash ? (
                      <button type="button" onClick={() => submit("restore", [r.id], returnTo)} className="btn btn-outline px-3 text-sm">Restore</button>
                    ) : (
                      <>
                        <button type="button" onClick={() => setEditing(r.id)} className="btn btn-outline px-3 text-sm" aria-label={`Quick edit ${r.title}`}>✎ Edit</button>
                        {r.status === "listed" ? <button type="button" onClick={() => submit("unpublish", [r.id], returnTo)} className="btn btn-outline px-3 text-sm">Unpublish</button>
                          : r.status === "draft" || r.status === "archived" || r.status === "sold" ? <button type="button" onClick={() => submit("publish", [r.id], returnTo)} className="btn btn-primary px-3 text-sm">Publish</button> : null}
                        <button type="button" onClick={() => run("trash", [r.id])} className="btn btn-outline px-3 text-sm text-red-700" aria-label={`Delete ${r.title}`}>🗑</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editing === r.id ? null : (
                <div className="mt-2 flex gap-2 sm:hidden">
                  {trash ? (
                    <button type="button" onClick={() => submit("restore", [r.id], returnTo)} className="btn btn-outline flex-1 text-sm">Restore</button>
                  ) : (
                    <>
                      <button type="button" onClick={() => setEditing(r.id)} className="btn btn-outline flex-1 text-sm">✎ Edit</button>
                      {r.status === "listed" ? <button type="button" onClick={() => submit("unpublish", [r.id], returnTo)} className="btn btn-outline flex-1 text-sm">Unpublish</button>
                        : r.status === "draft" || r.status === "archived" || r.status === "sold" ? <button type="button" onClick={() => submit("publish", [r.id], returnTo)} className="btn btn-primary flex-1 text-sm">Publish</button> : null}
                      <button type="button" onClick={() => run("trash", [r.id])} className="btn btn-outline px-4 text-sm text-red-700" aria-label={`Delete ${r.title}`}>🗑</button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {selected.length ? (
        <div style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }} className="fixed inset-x-2 z-[60] flex rounded-2xl border gap-2 overflow-x-auto border-slate-300 bg-white p-2 shadow-xl sm:hidden" data-testid="mobile-bulk-bar">
          <span className="self-center whitespace-nowrap px-1 text-sm font-semibold">{selected.length}</span>
          {bulkButtons.map((a) => (
            <button key={a} type="button" onClick={() => run(a, selected)} className={`btn whitespace-nowrap px-3 text-sm ${a === "trash" || a === "purge" ? "border-red-700 text-red-700" : "btn-outline"}`}>{VERB[a]}</button>
          ))}
        </div>
      ) : null}

      <dialog ref={dialog} onClose={() => setConfirm(null)} className="m-auto w-[min(92vw,28rem)] rounded-2xl p-0 backdrop:bg-black/40" data-testid="confirm-dialog">
        {confirm ? (
          <div className="space-y-3 p-5">
            <h2 className="text-lg font-semibold">{confirm.all ? "Empty trash?" : `${VERB[confirm.action]} ${confirm.ids.length} item${confirm.ids.length === 1 ? "" : "s"}?`}</h2>
            <p className="text-sm text-slate-700">
              {confirm.action === "trash" ? "They'll be hidden from the shop and moved to Trash. You can undo right after, or restore them from Trash any time."
                : confirm.action === "purge" ? "This permanently deletes the items in Trash, their inventory and photos. Past orders keep their own copy. This can't be undone."
                : confirm.action === "mark_sold" ? "They'll be hidden from the shop and marked Sold (for things that sold on Depop or in person)."
                : "They'll be hidden from the shop and kept as Archived."}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setConfirm(null)} autoFocus>Cancel</button>
              <button type="button" className={`btn ${confirm.action === "purge" || confirm.action === "trash" ? "border-red-700 bg-red-700 text-white" : "btn-primary"}`}
                onClick={() => submit(confirm.action, confirm.ids, returnTo, confirm.action === "purge" ? { confirm: "purge", ...(confirm.all ? { all: "trash" } : {}) } : {})}>
                {confirm.all ? "Empty trash" : VERB[confirm.action]}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
