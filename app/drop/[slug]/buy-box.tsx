"use client";
import Link from "next/link";
import { useState } from "react";
import { DEFAULT_OPTION, GARMENT_LABEL, OPTION_LABEL, PRICES_CENTS, SHIPPING_CENTS, SIZES, unitPrice, type Garment } from "@/lib/drop/config";

export function BuyBox({ slug, garments, adminPrices, garment: ctrl, onGarment }: { slug: string; garments: Garment[]; adminPrices?: Record<string, number>; garment?: Garment; onGarment?: (g: Garment) => void }) {
  const [own, setOwn] = useState<Garment>(garments[0]);
  const garment = ctrl ?? own;
  const setGarment = (g: Garment) => { setOwn(g); onGarment?.(g); };
  const [rawSize, setSize] = useState(DEFAULT_OPTION[garments[0]]);
  const size = SIZES[garment].includes(rawSize) ? rawSize : DEFAULT_OPTION[garment];
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
        {garments.map((g) => <button key={g} type="button" className="dd-opt" aria-pressed={g === garment} data-type={g} onClick={() => { setGarment(g); setSize(DEFAULT_OPTION[g]); }}>{GARMENT_LABEL[g]} · {SIZES[g].some((s) => unitPrice(g, s) !== PRICES_CENTS[g]) ? "from " : ""}${PRICES_CENTS[g] / 100}</button>)}
      </div>
      <div className="dd-opts" role="group" aria-label={OPTION_LABEL[garment]}>
        {SIZES[garment].map((s) => <button key={s} type="button" className="dd-opt" aria-pressed={s === size} onClick={() => setSize(s)}>{garment === "sticker" ? s.replace("in", "″") : s}</button>)}
      </div>
      <button className="dd-btn" onClick={buy} disabled={busy}>{busy ? "Opening secure checkout…" : `Buy · $${unitPrice(garment, size) / 100}`}</button>
      {adminPrices && (adminPrices[`${garment}:${size}`] !== undefined
        ? <p className="dd-note" data-admin-test>Admin cost price: ${(adminPrices[`${garment}:${size}`] / 100).toFixed(2)} incl. shipping (tax may apply). Only you see this.</p>
        : <p className="dd-note" data-admin-test>No cost on file for this option, so you&apos;ll pay the public price. Only you see this.</p>)}
      {err && <p className="dd-err" role="alert">{err}</p>}
      <p className="dd-note">+ ${(SHIPPING_CENTS[garment] / 100).toFixed(2)} shipping, sales tax at checkout. Printed to order in about 2–7 business days. <Link href="/drop/policies">Returns</Link></p>
    </div>
  );
}
