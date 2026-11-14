"use client";
import Link from "next/link";
import { useState } from "react";
import { CONSENT_TEXT, PROMO_RULE } from "@/lib/drop/signup";

export const PROMO_STORAGE_KEY = "dd_code";

/** Daily Drop signup (capture only, no email is sent). Shows the 10% code on screen and remembers it for checkout. */
export function DropSignup({ source, compact = false }: { source: string; compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string | null; already?: boolean; used?: boolean } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/drop/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent, website, source }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; code?: string | null; already?: boolean; used?: boolean; error?: string };
      if (r.ok && j.ok) {
        setDone({ code: j.code ?? null, already: j.already, used: j.used });
        if (j.code) try { localStorage.setItem(PROMO_STORAGE_KEY, j.code); } catch {}
      } else setErr(j.error ?? "Something went wrong. Please try again.");
    } catch { setErr("Network hiccup. Please try again."); }
    setBusy(false);
  }
  return (
    <section className={`dd-signup${compact ? " dd-signup-compact" : ""}`} data-drop-signup={source} aria-labelledby={`dd-signup-${source}`}>
      <h2 id={`dd-signup-${source}`} className="dd-signup-title">Get 10% off your first Daily Drop order</h2>
      {done ? (
        done.code ? (
          <div className="dd-signup-done" role="status" data-signup-done>
            <p>{done.already ? "You're already on the list. Here's your code again:" : "You're in! Your one-time code:"}</p>
            <p className="dd-signup-code" data-promo-code>{done.code}</p>
            <p className="dd-signup-note">Saved on this device, so it fills in at checkout on any <Link href="/drop">Daily Drop</Link> item. {PROMO_RULE}</p>
          </div>
        ) : <p role="status" data-signup-done>{done.used ? "You're on the list. Your first-order code has already been used." : "Thanks, you're on the list."}</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="dd-signup-note">New designs daily. Sign up and we&apos;ll show your code right here.</p>
          <div className="dd-signup-row">
            <label className="sr-only" htmlFor={`dd-email-${source}`}>Email</label>
            <input id={`dd-email-${source}`} className="dd-signup-input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
            <button className="dd-signup-btn" disabled={busy}>{busy ? "Signing up…" : "Get my code"}</button>
          </div>
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
            <label>Website <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" /></label>
          </div>
          <label className="dd-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required /> <span>{CONSENT_TEXT}</span></label>
          {err && <p className="dd-signup-err" role="alert">{err}</p>}
          <p className="dd-signup-note" data-unsub-link>Already signed up and want out? <Link href="/drop/unsubscribe">Unsubscribe</Link>.</p>
        </form>
      )}
    </section>
  );
}
