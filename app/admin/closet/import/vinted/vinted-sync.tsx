"use client";
import { useCallback, useEffect, useState } from "react";
import type { ImportJob } from "@/lib/importer/jobs";

/** "Sync my Vinted shop": admin-triggered only, one member-page read, then slow polite imports. */
export function VintedSync() {
  const [memberUrl, setMemberUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
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
    setError(null); setBusy(true); setJob(null);
    try {
      const r = await fetch("/api/admin/vinted/shop-sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberUrl }) });
      const d = await r.json();
      if (r.status === 409 && d.id) { setJobId(d.id); return; }
      if (!r.ok) { setError(d.error ?? `HTTP ${r.status}`); return; }
      setJobId(d.id);
    } catch {
      setError("Couldn't start the sync. Try again.");
    } finally { setBusy(false); }
  }, [memberUrl]);

  const running = job?.state === "running";
  const count = (s: string) => job?.results.filter((r) => r.status === s).length ?? 0;
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="member-url">Your Vinted member page</label>
      <input id="member-url" value={memberUrl} onChange={(e) => setMemberUrl(e.target.value)} placeholder="https://www.vinted.com/member/123456789-mrspock13" className="field-input w-full font-mono text-xs" />
      <button type="button" onClick={sync} disabled={busy || running || !memberUrl.trim()} className="btn btn-outline w-full sm:w-auto" data-testid="vinted-sync">🔄 Sync my Vinted shop</button>
      {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
      {job ? (
        <p className="text-sm text-slate-700" data-testid="vinted-sync-status">
          {running ? `Syncing… ${job.processed}/${job.total}` : job.state === "stopped" ? "Stopped: Vinted blocked or challenged the server. Add the rest by hand." : job.state === "done" ? "Sync finished." : "Sync failed (logged)."}
          {" "}{count("imported")} new drafts · {count("updated")} updated · {count("sold")} sold (skipped) · {count("duplicate")} unchanged · {count("error")} not imported
        </p>
      ) : null}
    </div>
  );
}
