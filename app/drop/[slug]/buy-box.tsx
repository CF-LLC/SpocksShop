"use client";
import Link from "next/link";
import { useState } from "react";
import { GARMENT_LABEL, PRICES_CENTS, SHIPPING_CENTS, SIZES, type Garment } from "@/lib/drop/config";

export function BuyBox({ slug, garments }: { slug: string; garments: Garment[] }) {
  const [garment, setGarment] = useState<Garment>(garments[0]);
  const [size, setSize] = useState("M");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function buy() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/drop/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ slug, garment, size, qty: 1 }] }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (r.ok && j.url) { window.location.href = j.url; return; }
      setErr(j.error ?? "Something went wrong. Please try again.");
    } catch { setErr("Network hiccup. Please try again."); }
    setBusy(false);
  }
  return (
    <div>
      <div className="dd-opts" role="group" aria-label="Style">
        {garments.map((g) => <button key={g} type="button" className="dd-opt" aria-pressed={g === garment} onClick={() => setGarment(g)}>{GARMENT_LABEL[g]} · ${PRICES_CENTS[g] / 100}</button>)}
      </div>
      <div className="dd-opts" role="group" aria-label="Size">
        {SIZES[garment].map((s) => <button key={s} type="button" className="dd-opt" aria-pressed={s === size} onClick={() => setSize(s)}>{s}</button>)}
      </div>
      <button className="dd-btn" onClick={buy} disabled={busy}>{busy ? "Opening secure checkout…" : `Buy · $${PRICES_CENTS[garment] / 100}`}</button>
      {err && <p className="dd-err" role="alert">{err}</p>}
      <p className="dd-note">+ ${(SHIPPING_CENTS[garment] / 100).toFixed(2)} shipping, sales tax at checkout. Printed to order in about 2–7 business days. <Link href="/drop/policies">Returns</Link></p>
    </div>
  );
}
