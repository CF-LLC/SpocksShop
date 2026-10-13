"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { normalizePhoto, removeBackground } from "@/lib/bg-removal/client";

type Item = {
  key: string;
  name: string;
  original: Blob | null;
  originalUrl: string | null;
  cutout: Blob | null;
  cutoutUrl: string | null;
  bitmap: ImageBitmap | null;
  status: "preparing" | "removing" | "ready" | "error" | "uploading" | "done";
  useCutout: boolean;
  message?: string;
};

let seq = 0;

/**
 * Phone-first photo uploader: camera capture or library pick (multiple), optional in-browser background removal
 * with a before/after preview per photo, and a per-photo "keep original" toggle. Uploads one photo per request.
 */
export function PhotoUploader({ productId, remaining, alt }: { productId: string; remaining: number; alt: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [autoRemove, setAutoRemove] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = useRef<string[]>([]);
  const router = useRouter();

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const url = (b: Blob) => { const u = URL.createObjectURL(b); urls.current.push(u); return u; };
  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function cutout(key: string, bitmap: ImageBitmap) {
    patch(key, { status: "removing" });
    try {
      const blob = await removeBackground(bitmap);
      patch(key, { cutout: blob, cutoutUrl: url(blob), status: "ready", useCutout: true });
    } catch (e) {
      console.error("background removal failed", e);
      patch(key, { status: "ready", useCutout: false, message: "Couldn't remove the background; the original will be used." });
    }
  }

  async function add(files: FileList | null) {
    setError(null);
    if (!files?.length) return;
    const room = remaining - items.filter((i) => i.status !== "done").length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (picked.length < files.length) setError(`Only ${room} more photo${room === 1 ? "" : "s"} fit on this item.`);
    const fresh: Item[] = picked.map((f) => ({ key: `p${++seq}`, name: f.name, original: null, originalUrl: null, cutout: null, cutoutUrl: null, bitmap: null, status: "preparing", useCutout: false }));
    setItems((list) => [...list, ...fresh]);
    // Sequential: keeps phone memory use low.
    for (let i = 0; i < picked.length; i++) {
      const key = fresh[i].key;
      try {
        const { blob, bitmap } = await normalizePhoto(picked[i]);
        patch(key, { original: blob, originalUrl: url(blob), bitmap, status: "ready" });
        if (autoRemove) await cutout(key, bitmap);
      } catch {
        patch(key, { status: "error", message: "This file couldn't be read as an image (try JPEG, PNG or WebP)." });
      }
    }
  }

  async function upload() {
    setBusy(true);
    setError(null);
    let ok = 0;
    for (const it of items) {
      if (it.status !== "ready" || !it.original) continue;
      const blob = it.useCutout && it.cutout ? it.cutout : it.original;
      const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
      const fd = new FormData();
      fd.append("photos", blob, `${it.key}.${ext}`);
      fd.append("alt", alt);
      patch(it.key, { status: "uploading" });
      try {
        const res = await fetch(`/api/admin/closet/${productId}/photos`, { method: "POST", body: fd, headers: { accept: "application/json" } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
        patch(it.key, { status: "done" });
        ok++;
      } catch (e) {
        patch(it.key, { status: "ready", message: (e as Error).message });
        setError((e as Error).message);
      }
    }
    setBusy(false);
    if (ok) {
      setItems((l) => l.filter((i) => i.status !== "done"));
      router.replace(`/admin/closet/${productId}?ok=${encodeURIComponent(`${ok} photo${ok === 1 ? "" : "s"} uploaded.`)}#photos`, { scroll: false });
      router.refresh();
    }
  }

  const pending = items.filter((i) => i.status === "ready").length;
  const working = items.some((i) => i.status === "preparing" || i.status === "removing");

  return (
    <div className="space-y-4" data-testid="photo-uploader">
      <div className="grid grid-cols-2 gap-3">
        <label className="btn btn-primary w-full cursor-pointer">
          📷 Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} disabled={busy || remaining <= 0} />
        </label>
        <label className="btn btn-outline w-full cursor-pointer">
          🖼️ Choose photos
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} disabled={busy || remaining <= 0} data-testid="photo-picker" />
        </label>
      </div>
      <label className="flex min-h-[44px] items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={autoRemove} onChange={(e) => setAutoRemove(e.target.checked)} />
        Remove backgrounds automatically (runs on this device)
      </label>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {items.length ? (
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.key} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2">
                <figure className={`rounded-lg border-2 p-1 ${!it.useCutout ? "border-amber-600" : "border-transparent"}`}>
                  {it.originalUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.originalUrl} alt="Original" className="aspect-square w-full rounded object-contain bg-slate-100" />
                  ) : <div className="grid aspect-square place-items-center rounded bg-slate-100 text-xs text-slate-500">Preparing…</div>}
                  <figcaption className="mt-1 text-center text-xs font-semibold text-slate-600">Before</figcaption>
                </figure>
                <figure className={`rounded-lg border-2 p-1 ${it.useCutout ? "border-amber-600" : "border-transparent"}`}>
                  {it.cutoutUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.cutoutUrl} alt="Background removed" className="checker aspect-square w-full rounded object-contain" />
                  ) : (
                    <div className="grid aspect-square place-items-center rounded bg-slate-100 p-2 text-center text-xs text-slate-500">
                      {it.status === "removing" ? "Removing background…" : it.bitmap ? (
                        <button type="button" className="btn btn-outline text-xs" onClick={() => cutout(it.key, it.bitmap!)}>Remove background</button>
                      ) : "—"}
                    </div>
                  )}
                  <figcaption className="mt-1 text-center text-xs font-semibold text-slate-600">After</figcaption>
                </figure>
              </div>
              {it.cutout ? (
                <div role="radiogroup" aria-label="Which version to upload" className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" role="radio" aria-checked={!it.useCutout} onClick={() => patch(it.key, { useCutout: false })} className={`btn ${!it.useCutout ? "btn-primary" : "btn-outline"}`}>Keep original</button>
                  <button type="button" role="radio" aria-checked={it.useCutout} onClick={() => patch(it.key, { useCutout: true })} className={`btn ${it.useCutout ? "btn-primary" : "btn-outline"}`}>Use cutout</button>
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-600">
                <span>{it.status === "done" ? "Uploaded ✓" : it.status === "uploading" ? "Uploading…" : it.message ?? (it.status === "error" ? "Error" : "")}</span>
                {it.status !== "uploading" && it.status !== "done" ? (
                  <button type="button" className="btn-text min-h-[44px] px-2 text-red-700" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>Remove</button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {items.length ? (
        <button type="button" className="btn btn-primary w-full" disabled={busy || working || pending === 0} onClick={upload} data-testid="upload-photos">
          {busy ? "Uploading…" : working ? "Processing…" : `Upload ${pending} photo${pending === 1 ? "" : "s"}`}
        </button>
      ) : null}
    </div>
  );
}
