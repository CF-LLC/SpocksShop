"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ImportJob } from "@/lib/importer/jobs";

type Missing = { id: string; title: string; change: string };

/** "Sync my Vinted shop": admin-triggered only, one member-page read, then drafts/updates with clear results. */
export function VintedSync({ defaultUrl }: { defaultUrl: string }) {
  const [memberUrl, setMemberUrl] = useState(defaultUrl);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [missing, setMissing] = useState<Missing[] | null>(null);
  const [complete, setComplete] = useState<boolean | null>(null);
  const [paging, setPaging] = useState<{ pagesFetched: number; expected: number | null; seen: number; reason: string | null } | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/admin/depop/jobs/${jobId}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) { setError(d.error ?? `HTTP ${r.status}`); return; }
        setJob(d);
        if (d.state === "running" && !stop) setTimeout(tick, 3000);
      } catch { if (!stop) setTimeout(tick, 5000); }
    };
    tick();
    return () => { stop = true; };
  }, [jobId]);

  const sync = useCallback(async () => {
    setError(null); setBusy(true); setJob(null); setMissing(null); setComplete(null); setPaging(null); setHeld(null);
    try {
      const r = await fetch("/api/admin/vinted/shop-sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberUrl }) });
      const d = await r.json();
      if (r.status === 409 && d.id) { setError("Another import is running; showing its progress."); setJobId(d.id); return; }
      if (!r.ok) { setError(d.error ?? `HTTP ${r.status}`); return; }
      setMissing(d.missing ?? []); setComplete(!!d.complete); setPaging(d.paging ?? null); setHeld(d.held ?? null); setJobId(d.id);
    } catch {
      setError("Couldn't start the sync. Try again.");
    } finally { setBusy(false); }
  }, [memberUrl]);

  const running = job?.state === "running";
  const count = (s: string) => job?.results.filter((r) => r.status === s).length ?? 0;
  const shown = job?.results.filter((r) => r.status !== "duplicate") ?? [];
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="member-url">Your Vinted member page</label>
      <input id="member-url" value={memberUrl} onChange={(e) => setMemberUrl(e.target.value)} className="field-input w-full font-mono text-xs" />
      <button type="button" onClick={sync} disabled={busy || running || !memberUrl.trim()} className="btn btn-outline w-full sm:w-auto" data-testid="vinted-sync">🔄 Sync my Vinted shop</button>
      {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
      {job ? (
        <div className="space-y-2 text-sm text-slate-700" data-testid="vinted-sync-status">
          <p>
            {running ? `Syncing… ${job.processed}/${job.total}` : job.state === "stopped" ? "Stopped: Vinted blocked or challenged the server. Nothing was bypassed; try later or add items by hand." : job.state === "done" ? "Sync finished." : "Sync failed (logged)."}
            {" "}<strong>{count("imported")}</strong> new drafts · <strong>{count("updated")}</strong> updated · <strong>{count("flagged")}</strong> kept your edit · <strong>{count("sold")}</strong> sold (no draft) · <strong>{missing?.length ?? 0}</strong> unpublished (gone from Vinted) · {count("duplicate")} unchanged · {count("error")} errors
          </p>
          {paging ? <p className="text-slate-600">Read {paging.seen}{paging.expected !== null ? ` of ${paging.expected}` : ""} items from your member page ({paging.pagesFetched} {paging.pagesFetched === 1 ? "request" : "requests"}).</p> : null}
          {complete === false ? <p className="text-amber-800">Couldn&apos;t confirm the full list of your Vinted items{paging?.reason ? ` (${paging.reason})` : ""}, so nothing was unpublished this time.</p> : null}
          {held ? <p className="text-amber-800">{held}</p> : null}
          <ul className="space-y-1">
            {shown.map((r, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-2">
                <span className="font-semibold">{r.status}</span>{" "}
                {"id" in r && r.id ? <Link href={`/admin/closet/${r.id}`} className="text-blue-700 underline">{"title" in r ? r.title : "item"}</Link> : "title" in r ? r.title : r.input}
                {r.status === "updated" ? ` · ${r.changes.join("; ")}` : r.status === "flagged" ? ` · ${r.flagged.join("; ")}` : r.status === "error" ? <span className="text-red-800"> · {r.error}</span> : r.status === "imported" ? ` · ${r.photos} photos${r.note ? ` · ${r.note}` : ""}` : ""}
              </li>
            ))}
            {missing?.map((m) => <li key={m.id} className="rounded-lg border border-slate-200 p-2"><span className="font-semibold">unpublished</span> <Link href={`/admin/closet/${m.id}`} className="text-blue-700 underline">{m.title}</Link> · {m.change}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
