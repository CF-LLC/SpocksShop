/**
 * In-browser background removal for admin photo uploads.
 * Model: U²-NetP (Apache-2.0), runtime: onnxruntime-web (MIT), both served from our own origin
 * (/models, /vendor/ort). Runs on the admin's phone/laptop; the mini PC does no image work.
 */
"use client";

const ORT_URL = "/vendor/ort/ort.wasm.min.mjs";
const MODEL_URL = "/models/u2netp.onnx";
const SIZE = 320; // U²-Net input resolution
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
/** Long edge of what we upload. Keeps files well under the 5 MB server limit. */
export const MAX_EDGE = 1600;

/* eslint-disable @typescript-eslint/no-explicit-any */
let sessionPromise: Promise<{ ort: any; session: any }> | null = null;

async function loadSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort: any = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ ORT_URL as string);
      ort.env.wasm.wasmPaths = "/vendor/ort/";
      ort.env.wasm.numThreads = 1; // no cross-origin isolation needed
      const session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      return { ort, session };
    })().catch((e) => {
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality));
}

/** Decode (incl. HEIC where the browser can), honour EXIF orientation, downscale, re-encode as JPEG. */
export async function normalizePhoto(file: Blob): Promise<{ blob: Blob; bitmap: ImageBitmap }> {
  const src = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(src.width, src.height));
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);
  const c = canvas(w, h);
  c.getContext("2d")!.drawImage(src, 0, 0, w, h);
  src.close();
  const blob = await toBlob(c, "image/jpeg", 0.88);
  return { blob, bitmap: await createImageBitmap(c) };
}

/** Returns a cut-out (transparent background) PNG/WebP of the photo. */
export async function removeBackground(bitmap: ImageBitmap): Promise<Blob> {
  const { ort, session } = await loadSession();
  const small = canvas(SIZE, SIZE);
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  const px = sctx.getImageData(0, 0, SIZE, SIZE).data;
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let ch = 0; ch < 3; ch++) input[ch * plane + i] = (px[i * 4 + ch] / 255 - MEAN[ch]) / STD[ch];
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) };
  const out = await session.run(feeds);
  const pred: Float32Array = out[session.outputNames[0]].data;

  let lo = Infinity;
  let hi = -Infinity;
  for (const v of pred) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const range = hi - lo || 1;
  const mask = sctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < plane; i++) {
    mask.data[i * 4 + 3] = Math.round(((pred[i] - lo) / range) * 255);
  }
  sctx.putImageData(mask, 0, 0);

  const w = bitmap.width;
  const h = bitmap.height;
  const outC = canvas(w, h);
  const octx = outC.getContext("2d")!;
  octx.drawImage(bitmap, 0, 0, w, h);
  octx.globalCompositeOperation = "destination-in";
  octx.imageSmoothingQuality = "high";
  octx.drawImage(small, 0, 0, w, h);
  // WebP keeps alpha and is far smaller than PNG; Safari falls back to PNG.
  const webp = await toBlob(outC, "image/webp", 0.9);
  return webp.type === "image/webp" ? webp : toBlob(outC, "image/png");
}
