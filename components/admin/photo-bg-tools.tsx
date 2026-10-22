"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizePhoto, removeBackground } from "@/lib/bg-removal/client";

/**
 * "Remove background" for a photo that's already on an item (incl. Depop imports). Runs on this device,
 * uploads the cut-out in place of the photo, and the server keeps the original for "Revert".
 */
export function PhotoBgTools({ photoId, src, hasOriginal }: { photoId: string; src: string; hasOriginal: boolean }) {
  const [bg, setBg] = useState<"white" | "transparent">("white");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load the photo (${res.status}).`);
      const { bitmap } = await normalizePhoto(await res.blob());
      const blob = await removeBackground(bitmap, bg);
      bitmap.close();
      const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
      const fd = new FormData();
      fd.append("intent", "cutout");
      fd.append("photo", blob, `cutout.${ext}`);
      const up = await fetch(`/api/admin/photos/${photoId}`, { method: "POST", body: fd, headers: { accept: "application/json" } });
      const body = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(body.error ?? `Upload failed (${up.status})`);
      router.refresh();
    } catch (e) {
      console.error("background removal failed", e);
      setError((e as Error).message || "Couldn't remove the background.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 space-y-1" data-testid="photo-bg-tools">
      {hasOriginal ? (
        <form action={`/api/admin/photos/${photoId}`} method="post">
          <input type="hidden" name="intent" value="revert" />
          <button className="btn btn-outline w-full text-xs" data-testid="bg-revert">↩ Revert to original</button>
        </form>
      ) : (
        <>
          <button type="button" className="btn btn-outline w-full text-xs" onClick={run} disabled={busy} data-testid="bg-remove">
            {busy ? "Removing background…" : "✂ Remove background"}
          </button>
          <select aria-label="New background" className="w-full rounded border border-slate-200 bg-white p-1 text-xs" value={bg} onChange={(e) => setBg(e.target.value as "white" | "transparent")} disabled={busy}>
            <option value="white">White background</option>
            <option value="transparent">Transparent</option>
          </select>
        </>
      )}
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
