"use client";
import { useState } from "react";

export function UnsubscribeButton({ e, t }: { e: string; t: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function go() {
    setState("busy");
    try {
      const r = await fetch("/api/drop/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ e, t }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && j.ok) setState("done"); else { setState("error"); setMsg(j.error ?? "Something went wrong."); }
    } catch { setState("error"); setMsg("Network hiccup. Please try again."); }
  }
  if (state === "done") return <p role="status" data-unsub-done>Done. {e} won&apos;t get any more Daily Drop emails. Changed your mind? Just sign up again on the <a href="/drop">Daily Drop</a>.</p>;
  return (
    <div>
      <button type="button" className="dd-signup-btn" onClick={go} disabled={state === "busy"} data-unsub-btn>{state === "busy" ? "Unsubscribing…" : "Unsubscribe"}</button>
      {state === "error" && <p className="dd-signup-err" role="alert">{msg}</p>}
    </div>
  );
}
