// Copy the onnxruntime-web WASM runtime into public/vendor/ort so the admin uploader can load it
// from our own origin (self-hosted, no CDN). Runs before `next build` and `next dev`.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const src = join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
const out = join(process.cwd(), "public", "vendor", "ort");
const files = ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"];
if (!existsSync(src)) { console.warn("copy-ort: onnxruntime-web not installed, skipping"); process.exit(0); }
mkdirSync(out, { recursive: true });
for (const f of files) copyFileSync(join(src, f), join(out, f));
console.log(`copy-ort: ${files.length} files -> public/vendor/ort`);
