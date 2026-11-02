"use client";
import { useState } from "react";
import { track } from "@/components/analytics";
import { PRICES_CENTS, SHIPPING_CENTS, SIZES } from "@/lib/drop/config";
import { BUNDLE_PRICE, DEALS, TWO_TEE_PRICE } from "@/lib/drop/deals";

const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

function SizeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="dd-note" style={{ display: "inline-flex", gap: ".4rem", alignItems: "center", marginRight: ".8rem" }}>
      {label}
      <select className="dd-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} size`}>
        {SIZES.tee.map((s) => <option key={s}>{s}</option>)}
      </select>
    </label>
  );
}

/** Tee + Hoodie bundle and 2-tee deal for one design. Prices are re-applied server-side; this only builds the cart. */
export function DealsBox({ slug }: { slug: string }) {
  const [a, setA] = useState({ tee: "M", hoodie: "M" });
  const [b, setB] = useState({ one: "M", two: "M" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go(key: string, items: { garment: string; size: string }[]) {
    setBusy(key); setErr(null);
    try {
      track("checkout_start");
      const r = (await fetch("/api/drop/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: items.map((i) => ({ slug, ...i, qty: 1 })) }) }));
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (r.ok && j.url) { window.location.href = j.url; return; }
      setErr(j.error ?? "Something went wrong. Please try again.");
    } catch { setErr("Network hiccup. Please try again."); }
    setBusy(null);
  }
  const bundleSave = PRICES_CENTS.tee + PRICES_CENTS.hoodie - BUNDLE_PRICE;
  const twoSave = PRICES_CENTS.tee * 2 - TWO_TEE_PRICE;
  return (
    <div className="dd-panel" data-deals>
      <div className="dd-kicker">Deals</div>
      <div className="dd-deal" data-deal="bundle">
        <h3>{DEALS.bundle.label} · {usd(BUNDLE_PRICE)} <span className="dd-save">save {usd(bundleSave)}</span></h3>
        <SizeSelect label="Tee" value={a.tee} onChange={(v) => setA({ ...a, tee: v })} />
        <SizeSelect label="Hoodie" value={a.hoodie} onChange={(v) => setA({ ...a, hoodie: v })} />
        <p className="dd-note">At checkout: tee {usd(DEALS.bundle.tee)} + hoodie {usd(DEALS.bundle.hoodie)} (was {usd(PRICES_CENTS.tee + PRICES_CENTS.hoodie)}), + {usd(SHIPPING_CENTS.hoodie)} shipping.</p>
        <button className="dd-btn" disabled={!!busy} onClick={() => go("bundle", [{ garment: "tee", size: a.tee }, { garment: "hoodie", size: a.hoodie }])}>{busy === "bundle" ? "Opening secure checkout…" : `Get the bundle · ${usd(BUNDLE_PRICE)}`}</button>
      </div>
      <div className="dd-deal" data-deal="two-tees">
        <h3>{DEALS.twoTees.label} · 2 tees for {usd(TWO_TEE_PRICE)} <span className="dd-save">save {usd(twoSave)}</span></h3>
        <SizeSelect label="Tee 1" value={b.one} onChange={(v) => setB({ ...b, one: v })} />
        <SizeSelect label="Tee 2" value={b.two} onChange={(v) => setB({ ...b, two: v })} />
        <p className="dd-note">At checkout: 2 × tee {usd(DEALS.twoTees.tee)} (was {usd(PRICES_CENTS.tee * 2)}), + {usd(SHIPPING_CENTS.tee)} shipping.</p>
        <button className="dd-btn" disabled={!!busy} onClick={() => go("two", [{ garment: "tee", size: b.one }, { garment: "tee", size: b.two }])}>{busy === "two" ? "Opening secure checkout…" : `Get 2 tees · ${usd(TWO_TEE_PRICE)}`}</button>
      </div>
      <p className="dd-note">Deals apply automatically at checkout, also across designs (each hoodie pairs with a tee, extra tees pair up).</p>
      {err && <p className="dd-err" role="alert">{err}</p>}
    </div>
  );
}
