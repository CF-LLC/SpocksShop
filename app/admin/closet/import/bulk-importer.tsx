"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportJob } from "@/lib/depop/jobs";
import { countPasted } from "@/lib/depop/payload";

const POLL_MS = 2000;

/** Drag-to-bookmarks link. React blocks javascript: hrefs in JSX, so the href is set on the DOM node. */
export function BookmarkletButton({ href }: { href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => { ref.current?.setAttribute("href", href); }, [href]);
  return (
    <a ref={ref} data-testid="depop-bookmarklet" draggable onClick={(e) => { e.preventDefault(); alert("Drag this button to your bookmarks bar, then click the bookmark while you're on your Depop shop page."); }} className="btn btn-primary inline-flex cursor-grab">
      ⭐ Grab my Depop links
    </a>
  );
}

export function BulkImporter({ maxLinks }: { maxLinks: number }) {
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = countPasted(text);

  // Pick up a job that is still running after a page reload.
  useEffect(() => {
    fetch("/api/admin/depop/jobs", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.id) setJobId(d.id); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let misses = 0;
    const tick = async () => {
      try {
        const r = await fetch(`/api/admin/depop/jobs/${jobId}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) { setError(d.error ?? `HTTP ${r.status}`); return; }
        misses = 0;
        setJob(d);
        if (d.state !== "running") return;
      } catch {
        // Network blip or timeout: keep polling, the job runs on the server regardless.
        if (++misses > 30) { setError("Lost contact with the server. Reload the page to check progress."); return; }
      }
      if (!stop) setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { stop = true; };
  }, [jobId]);

  const start = useCallback(async () => {
    setError(null); setBusy(true); setJob(null);
    try {
      const r = await fetch("/api/admin/depop/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ links: text }) });
      const d = await r.json();
      if (r.status === 409 && d.id) { setJobId(d.id); setError("An import was already running; showing its progress."); return; }
      if (!r.ok) { setError(d.error ?? `HTTP ${r.status}`); return; }
      setJobId(d.id);
    } catch {
      setError("Couldn't start the import. Try again.");
    } finally {
      setBusy(false);
    }
  }, [text]);

  const running = job?.state === "running";
  const imported = job?.results.filter((r) => r.status === "imported") ?? [];
  const dupes = job?.results.filter((r) => r.status === "duplicate") ?? [];
  const failed = job?.results.filter((r) => r.status === "error") ?? [];
  const pct = job && job.total ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="surface-panel space-y-3 rounded-2xl p-4">
        <label className="block text-sm font-medium" htmlFor="bulk-links">Depop listing links (up to {maxLinks})</label>
        <textarea id="bulk-links" rows={8} value={text} onChange={(e) => setText(e.target.value)} disabled={running}
          placeholder={"Paste exactly what the bookmark copied"} className="field-input w-full font-mono text-xs" />
        <p className="text-xs text-slate-500">{count} link{count === 1 ? "" : "s"} pasted{count > maxLinks ? ` (only the first ${maxLinks} will be imported)` : ""}. Duplicates and items you already imported are skipped. Imports run on the server in batches of 20 with a ~2.5 second pause per listing (about 10 minutes for 200), so you can leave this page open or come back later.</p>
        <button type="button" onClick={start} disabled={busy || running || !count} className="btn btn-primary w-full sm:w-auto">{running ? "Importing…" : "Import all as drafts"}</button>
        {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      </div>

      {job ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" data-testid="bulk-progress" aria-live="polite">
          <h2 className="text-lg font-semibold">{running ? "Importing…" : job.state === "done" ? "Import finished" : job.state === "stopped" ? "Import stopped: Depop asked us to slow down" : "Import failed (logged)"}</h2>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="text-sm text-slate-700">{job.processed} of {job.total} handled{job.batches ? ` · batch ${job.batch || 1} of ${job.batches}` : ""} · {imported.length} imported as drafts · {dupes.length} already imported or repeated · {failed.length} not imported</p>
          {job.tooMany ? <p className="text-sm text-amber-800">Only the first {maxLinks} links were taken. Paste the rest after this finishes.</p> : null}
          {imported.length ? (
            <details open={!running}><summary className="cursor-pointer text-sm font-semibold">Drafts to review ({imported.length})</summary>
              <ul className="mt-2 space-y-1 text-sm">{imported.map((r) => r.status === "imported" ? <li key={r.id}><Link href={`/admin/closet/${r.id}`} className="text-blue-700 underline">{r.title}</Link> <span className="text-slate-500">· {r.photos} photo{r.photos === 1 ? "" : "s"}{r.note ? ` · ${r.note}` : ""}</span></li> : null)}</ul>
            </details>
          ) : null}
          {failed.length ? (
            <div className="space-y-2" data-testid="bulk-failed">
              <h3 className="text-sm font-semibold text-red-900">Add these by hand ({failed.length})</h3>
              <textarea readOnly rows={Math.min(8, failed.length + 1)} value={failed.map((r) => r.input).join("\n")} className="field-input w-full font-mono text-xs" aria-label="Failed links" />
              <ul className="space-y-1 text-xs text-red-800">{failed.map((r, i) => r.status === "error" ? <li key={i}><span className="break-all text-slate-600">{r.input}</span>: {r.error}</li> : null)}</ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
