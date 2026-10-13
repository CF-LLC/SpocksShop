"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { normalizePhoto, removeBackground } from "@/lib/bg-removal/client";
import { downscaleForAi } from "@/lib/ai/downscale";
import { productConditions } from "@/lib/types";

type Photo = {
  key: string;
  original: Blob | null;
  originalUrl: string | null;
  cutout: Blob | null;
  cutoutUrl: string | null;
  bitmap: ImageBitmap | null;
  status: "preparing" | "removing" | "ready" | "error";
  useCutout: boolean;
  message?: string;
};

type Fields = { title: string; price: string; condition: string; brand: string; size: string; material: string; description: string };
type FieldKey = keyof Fields;
const EMPTY: Fields = { title: "", price: "", condition: "Good", brand: "", size: "", material: "", description: "" };
const AI_FIELDS: [FieldKey, string][] = [
  ["title", "Title"], ["price", "Price ($)"], ["condition", "Condition"], ["brand", "Brand"], ["size", "Size"], ["material", "Material"], ["description", "Description"],
];

let seq = 0;
const label = "block text-sm font-medium text-slate-800";
const input = "field-input mt-1 w-full";

/** Compose the saved description: size/material become plain lines so they show on the product page. */
export function composeDescription(f: Pick<Fields, "description" | "size" | "material">) {
  const extra = [f.size.trim() && `Size: ${f.size.trim()}`, f.material.trim() && `Material: ${f.material.trim()}`].filter(Boolean);
  return [f.description.trim(), extra.join("\n")].filter(Boolean).join("\n\n");
}

/**
 * Photo-first new-item flow: 1) add + order photos (first = cover), optional background removal,
 * 2) optional AI suggestions the admin accepts per field, 3) save. Nothing is stored until "Save item".
 */
export function NewListing({ aiEnabled, maxPhotos, categories }: { aiEnabled: boolean; maxPhotos: number; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"photos" | "details">("photos");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [autoRemove, setAutoRemove] = useState(true);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [extra, setExtra] = useState({ quantity: "1", status: "draft", categoryId: "" });
  const [ai, setAi] = useState<{ state: "idle" | "loading" | "ready" | "error" | "skipped"; values?: Fields; error?: string; used: Set<FieldKey>; cost?: number }>({ state: "idle", used: new Set() });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const url = (b: Blob) => { const u = URL.createObjectURL(b); urls.current.push(u); return u; };
  const patch = (key: string, p: Partial<Photo>) => setPhotos((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const chosen = (p: Photo) => (p.useCutout && p.cutout ? p.cutout : p.original);

  async function cutout(key: string, bitmap: ImageBitmap) {
    patch(key, { status: "removing" });
    try {
      const blob = await removeBackground(bitmap);
      patch(key, { cutout: blob, cutoutUrl: url(blob), status: "ready", useCutout: true });
    } catch (e) {
      console.error("background removal failed", e);
      patch(key, { status: "ready", useCutout: false, message: "Background removal failed; using the original." });
    }
  }

  async function add(files: FileList | null) {
    setError(null);
    if (!files?.length) return;
    const room = maxPhotos - photos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (picked.length < files.length) setError(`Up to ${maxPhotos} photos per item.`);
    const fresh: Photo[] = picked.map(() => ({ key: `n${++seq}`, original: null, originalUrl: null, cutout: null, cutoutUrl: null, bitmap: null, status: "preparing", useCutout: false }));
    setPhotos((l) => [...l, ...fresh]);
    for (let i = 0; i < picked.length; i++) {
      const key = fresh[i].key;
      try {
        const { blob, bitmap } = await normalizePhoto(picked[i]);
        patch(key, { original: blob, originalUrl: url(blob), bitmap, status: "ready" });
        if (autoRemove) await cutout(key, bitmap);
      } catch {
        patch(key, { status: "error", message: "Couldn't read this image (try JPEG, PNG or WebP)." });
      }
    }
  }

  function move(i: number, d: -1 | 1) {
    setPhotos((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  const ready = photos.filter((p) => p.status === "ready" && p.original);
  const working = photos.some((p) => p.status === "preparing" || p.status === "removing");

  async function suggest() {
    setAi({ state: "loading", used: new Set() });
    try {
      const fd = new FormData();
      for (const p of ready.slice(0, 4)) fd.append("photos", await downscaleForAi(chosen(p)!), `${p.key}.jpg`);
      const res = await fetch("/api/admin/ai/suggest", { method: "POST", body: fd, headers: { accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `AI request failed (${res.status})`);
      const s = body.suggestion;
      setAi({
        state: "ready",
        used: new Set(),
        cost: body.usage?.estCostUsd,
        values: { title: s.title, price: String(s.priceUsd), condition: s.condition, brand: s.brand, size: s.size, material: s.material, description: s.description },
      });
    } catch (e) {
      setAi({ state: "error", used: new Set(), error: (e as Error).message });
    }
  }

  function accept(keys: FieldKey[]) {
    if (!ai.values) return;
    const v = ai.values;
    setFields((f) => ({ ...f, ...Object.fromEntries(keys.map((k) => [k, v[k]])) }));
    setAi((a) => ({ ...a, used: new Set([...a.used, ...keys]) }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving("Creating item…");
    try {
      const fd = new FormData();
      fd.set("title", fields.title);
      fd.set("price", fields.price);
      fd.set("condition", fields.condition);
      fd.set("brand", fields.brand);
      fd.set("description", composeDescription(fields));
      fd.set("quantity", extra.quantity);
      fd.set("status", extra.status);
      fd.set("categoryId", extra.categoryId);
      const res = await fetch("/api/admin/closet", { method: "POST", body: fd, headers: { accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`);
      const id: string = body.id;
      let n = 0;
      for (const p of ready) {
        setSaving(`Uploading photo ${++n} of ${ready.length}…`);
        const blob = chosen(p)!;
        const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
        const pf = new FormData();
        pf.append("photos", blob, `${p.key}.${ext}`);
        pf.append("alt", fields.title);
        const r = await fetch(`/api/admin/closet/${id}/photos`, { method: "POST", body: pf, headers: { accept: "application/json" } });
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          router.push(`/admin/closet/${id}?error=${encodeURIComponent(`Item saved, but photo ${n} failed: ${b.error ?? r.status}. Add it below.`)}#photos`);
          return;
        }
      }
      router.push(`/admin/closet/${id}?ok=${encodeURIComponent(`Item saved with ${ready.length} photo${ready.length === 1 ? "" : "s"}.`)}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(null);
    }
  }

  const set = (k: FieldKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-5" data-testid="new-listing">
      <ol className="flex gap-2 text-sm" aria-label="Steps">
        <li className={`rounded-full px-3 py-1 ${step === "photos" ? "bg-slate-900 text-white" : "bg-slate-100"}`}>1 · Photos</li>
        <li className={`rounded-full px-3 py-1 ${step === "details" ? "bg-slate-900 text-white" : "bg-slate-100"}`}>2 · Details</li>
      </ol>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {step === "photos" ? (
        <section className="space-y-4" data-testid="photo-step">
          <div className="grid grid-cols-2 gap-3">
            <label className="btn btn-primary w-full cursor-pointer">📷 Take photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} disabled={photos.length >= maxPhotos} />
            </label>
            <label className="btn btn-outline w-full cursor-pointer">🖼️ Choose photos
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} disabled={photos.length >= maxPhotos} data-testid="photo-picker" />
            </label>
          </div>
          <label className="flex min-h-[44px] items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={autoRemove} onChange={(e) => setAutoRemove(e.target.checked)} />
            Remove backgrounds automatically (on this device)
          </label>
          {photos.length ? <p className="text-sm text-slate-600">The first photo is the cover. Use ↑ ↓ to reorder.</p> : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">Start with photos. Snap the item or pick from your library.</p>}
          <ul className="space-y-3">
            {photos.map((p, i) => (
              <li key={p.key} className="rounded-xl border border-slate-200 bg-white p-3" data-testid="photo-item">
                <div className="flex gap-3">
                  <div className="relative w-28 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.originalUrl ? <img src={(p.useCutout && p.cutoutUrl) || p.originalUrl} alt={`Photo ${i + 1}`} className={`aspect-square w-full rounded-lg object-contain ${p.useCutout ? "checker" : "bg-slate-100"}`} /> : <div className="grid aspect-square place-items-center rounded-lg bg-slate-100 text-xs text-slate-500">Preparing…</div>}
                    {i === 0 ? <span className="absolute left-1 top-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">Cover</span> : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 text-sm">
                    <p className="text-slate-600">{p.status === "removing" ? "Removing background…" : p.status === "preparing" ? "Preparing…" : p.message ?? (p.cutout ? (p.useCutout ? "Background removed" : "Original") : "Original")}</p>
                    {p.cutout ? (
                      <button type="button" className="btn btn-outline min-h-[44px] text-xs" onClick={() => patch(p.key, { useCutout: !p.useCutout })}>{p.useCutout ? "Use original" : "Use cutout"}</button>
                    ) : p.bitmap && p.status === "ready" ? (
                      <button type="button" className="btn btn-outline min-h-[44px] text-xs" onClick={() => cutout(p.key, p.bitmap!)}>Remove background</button>
                    ) : null}
                    <div className="flex gap-2">
                      <button type="button" aria-label="Move up" className="btn btn-outline min-h-[44px] flex-1" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button type="button" aria-label="Move down" className="btn btn-outline min-h-[44px] flex-1" disabled={i === photos.length - 1} onClick={() => move(i, 1)}>↓</button>
                      <button type="button" aria-label="Remove photo" className="btn btn-outline min-h-[44px] flex-1 text-red-700" onClick={() => setPhotos((l) => l.filter((x) => x.key !== p.key))}>✕</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-20 md:bottom-2 z-10 rounded-2xl bg-white/90 p-2 backdrop-blur">
            <button type="button" className="btn btn-primary w-full" disabled={working || ready.length === 0} onClick={() => setStep("details")} data-testid="to-details">
              {working ? "Processing photos…" : `Next: details (${ready.length} photo${ready.length === 1 ? "" : "s"})`}
            </button>
          </div>
        </section>
      ) : (
        <form onSubmit={save} className="space-y-4" data-testid="details-step">
          <div className="flex gap-2 overflow-x-auto">
            {ready.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.key} src={(p.useCutout && p.cutoutUrl) || p.originalUrl!} alt={`Photo ${i + 1}`} className={`h-16 w-16 shrink-0 rounded-lg object-contain ${p.useCutout ? "checker" : "bg-slate-100"} ${i === 0 ? "ring-2 ring-amber-500" : ""}`} />
            ))}
            <button type="button" className="btn-text shrink-0 px-2 text-sm" onClick={() => setStep("photos")}>Edit photos</button>
          </div>

          {aiEnabled ? (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3" data-testid="ai-panel">
              {ai.state === "idle" || ai.state === "error" ? (
                <div className="space-y-2">
                  <button type="button" className="btn btn-primary w-full" onClick={suggest} data-testid="ai-suggest">✨ Suggest details from photos</button>
                  {ai.state === "error" ? <p role="alert" className="text-sm text-red-800">{ai.error}</p> : <p className="text-xs text-slate-600">Sends up to 4 downscaled photos to the AI. Nothing is saved until you tap Save.</p>}
                </div>
              ) : ai.state === "loading" ? (
                <p className="py-3 text-center text-sm" aria-live="polite">Looking at your photos…</p>
              ) : ai.state === "skipped" ? (
                <button type="button" className="btn-text text-sm" onClick={() => setAi({ state: "idle", used: new Set() })}>Show AI suggestions again</button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">AI suggestions</h2>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary min-h-[44px] text-sm" onClick={() => accept(AI_FIELDS.map(([k]) => k))} data-testid="ai-use-all">Use all</button>
                      <button type="button" className="btn btn-outline min-h-[44px] text-sm" onClick={() => setAi({ state: "skipped", used: new Set() })} data-testid="ai-skip">Skip</button>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {AI_FIELDS.map(([k, name]) => (
                      <li key={k} className="rounded-lg bg-white p-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</span>
                        <div className="mt-1 flex items-start gap-2">
                          {k === "description" ? (
                            <textarea aria-label={`Suggested ${name}`} rows={3} className="field-input w-full text-sm" value={ai.values![k]} onChange={(e) => setAi((a) => ({ ...a, values: { ...a.values!, [k]: e.target.value } }))} />
                          ) : (
                            <input aria-label={`Suggested ${name}`} className="field-input w-full text-sm" value={ai.values![k]} onChange={(e) => setAi((a) => ({ ...a, values: { ...a.values!, [k]: e.target.value } }))} />
                          )}
                          <button type="button" className={`btn min-h-[44px] shrink-0 text-sm ${ai.used.has(k) ? "btn-outline" : "btn-primary"}`} onClick={() => accept([k])}>{ai.used.has(k) ? "Used ✓" : "Use"}</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500">Check everything before saving; the AI can be wrong.{ai.cost != null ? ` Est. cost $${ai.cost.toFixed(4)}.` : ""}</p>
                </div>
              )}
            </section>
          ) : (
            <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600" data-testid="ai-off">AI suggestions are off (no AI key configured). Fill in the details below.</p>
          )}

          <label className={label}>Title<input name="title" required minLength={2} maxLength={160} value={fields.title} onChange={set("title")} className={input} placeholder="e.g. Vintage Pyrex mixing bowl" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>Price ($)<input name="price" type="number" inputMode="decimal" step="0.01" min="0.01" required value={fields.price} onChange={set("price")} className={input} /></label>
            <label className={label}>Quantity<input name="quantity" type="number" inputMode="numeric" min="0" required value={extra.quantity} onChange={(e) => setExtra((x) => ({ ...x, quantity: e.target.value }))} className={input} /></label>
          </div>
          <label className={label}>Condition
            <select name="condition" value={fields.condition} onChange={set("condition")} className={input}>{productConditions.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>Brand<input name="brand" value={fields.brand} onChange={set("brand")} className={input} /></label>
            <label className={label}>Size<input name="size" value={fields.size} onChange={set("size")} className={input} /></label>
          </div>
          <label className={label}>Material<input name="material" value={fields.material} onChange={set("material")} className={input} /></label>
          <label className={label}>Description<textarea name="description" rows={4} value={fields.description} onChange={set("description")} className={input} placeholder="Measurements, flaws, story…" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>Category
              <select name="categoryId" value={extra.categoryId} onChange={(e) => setExtra((x) => ({ ...x, categoryId: e.target.value }))} className={input}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className={label}>Status
              <select name="status" value={extra.status} onChange={(e) => setExtra((x) => ({ ...x, status: e.target.value }))} className={input}>
                <option value="draft">Draft (hidden)</option>
                <option value="listed">Live in shop</option>
              </select>
            </label>
          </div>
          <div className="sticky bottom-20 md:bottom-2 z-10 rounded-2xl bg-white/90 p-2 backdrop-blur">
            <button type="submit" className="btn btn-primary w-full" disabled={Boolean(saving)} data-testid="save-item">{saving ?? "Save item"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
