"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PROMO_STORAGE_KEY } from "@/components/drop/signup-form";
import { promoAmount, promoEligible } from "@/lib/drop/signup";
import { DEFAULT_OPTION, GARMENT_LABEL, OPTION_LABEL, PRICES_CENTS, SHIPPING_CENTS, SIZES, unitPrice, type Garment } from "@/lib/drop/config";

export function BuyBox({ slug, garments, adminPrices, garment: ctrl, onGarment }: { slug: string; garments: Garment[]; adminPrices?: Record<string, number>; garment?: Garment; onGarment?: (g: Garment) => void }) {
  const [own, setOwn] = useState<Garment>(garments[0]);
  const garment = ctrl ?? own;
  const setGarment = (g: Garment) => { setOwn(g); onGarment?.(g); };
  const [rawSize, setSize] = useState(DEFAULT_OPTION[garments[0]]);
  const size = SIZES[garment].includes(rawSize) ? rawSize : DEFAULT_OPTION[garment];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  // Read after mount (localStorage isn't available during SSR).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { setCode(localStorage.getItem(PROMO_STORAGE_KEY) ?? ""); } catch {} }, []);
  const saveCode = (c: string) => { setCode(c); try { if (c) localStorage.setItem(PROMO_STORAGE_KEY, c); else localStorage.removeItem(PROMO_STORAGE_KEY); } catch {} };
  const codeOn = !adminPrices && code.trim() !== "" && promoEligible(garment, size);
  async function buy() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/drop/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ slug, garment, size, qty: 1 }], ...(codeOn ? { code: code.trim() } : {}) }) });
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
      <button className="dd-btn" onClick={buy} disabled={busy}>{busy ? "Opening secure checkout…" : codeOn ? `Buy · $${(promoAmount(unitPrice(garment, size)) / 100).toFixed(2)} (10% off)` : `Buy · $${unitPrice(garment, size) / 100}`}</button>
      {!adminPrices && (
        <p className="dd-note dd-codeline" data-promo-field>
          <label>Code <input className="dd-input dd-input-sm" value={code} onChange={(e) => saveCode(e.target.value.toUpperCase())} placeholder="DROP10-…" maxLength={13} autoComplete="off" /></label>
          {code && !promoEligible(garment, size) ? " Not valid on stickers or 2XL." : code ? " 10% off applies at checkout." : " Have a first-order code? Enter it here."}
        </p>
      )}
      {adminPrices && (adminPrices[`${garment}:${size}`] !== undefined
        ? <p className="dd-note" data-admin-test>Admin cost price: ${(adminPrices[`${garment}:${size}`] / 100).toFixed(2)} incl. shipping (tax may apply). Only you see this.</p>
        : <p className="dd-note" data-admin-test>No cost on file for this option, so you&apos;ll pay the public price. Only you see this.</p>)}
      {err && <p className="dd-err" role="alert">{err}</p>}
      <p className="dd-note">+ ${(SHIPPING_CENTS[garment] / 100).toFixed(2)} shipping, sales tax at checkout. Printed to order in about 2–7 business days. <Link href="/drop/policies">Returns</Link></p>
    </div>
  );
}
