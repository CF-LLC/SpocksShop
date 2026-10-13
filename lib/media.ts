import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

export const MEDIA_DIR = process.env.MEDIA_DIR ?? "/var/spocks/media";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 8;
/** Hard cap per product (keeps the media volume tidy). */
export const MAX_PHOTOS_PER_PRODUCT = 12;

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export class MediaError extends Error {}

/** Resolve a stored relative path inside MEDIA_DIR, refusing traversal. */
export function resolveMediaPath(relative: string): string {
  const root = path.resolve(/* turbopackIgnore: true */ MEDIA_DIR);
  const full = path.resolve(/* turbopackIgnore: true */ root, relative);
  if (full !== root && !full.startsWith(root + path.sep)) throw new MediaError("Invalid media path");
  return full;
}

export function validatePhoto(file: { type: string; size: number }): string {
  const ext = TYPES[file.type];
  if (!ext) throw new MediaError("Photos must be JPEG, PNG or WebP.");
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) throw new MediaError("Each photo must be under 5 MB.");
  return ext;
}

/** Detect the real image type from magic bytes (never trust the browser's Content-Type). */
export function sniffImage(buf: Uint8Array): "jpg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return "png";
  if (buf.length >= 12 && String.fromCharCode(...buf.subarray(0, 4)) === "RIFF" && String.fromCharCode(...buf.subarray(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Save an uploaded photo under MEDIA_DIR/<folder>/ and return its relative storage path. */
export async function savePhoto(file: File, folder: string): Promise<string> {
  validatePhoto(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) throw new MediaError("That file isn't a real JPEG, PNG or WebP image.");
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "");
  const relative = `${safeFolder}/${randomBytes(12).toString("hex")}.${ext}`;
  const full = resolveMediaPath(relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { mode: 0o644 });
  return relative;
}

export async function readMedia(relative: string) {
  return readFile(resolveMediaPath(relative));
}

export async function deleteMedia(relative: string) {
  try {
    await unlink(resolveMediaPath(relative));
  } catch {
    // already gone
  }
}

export function mediaUrl(relative: string): string {
  return `/media/${relative}`;
}

export function photoFiles(form: FormData, field = "photos"): File[] {
  return form
    .getAll(field)
    .filter((v): v is File => typeof v === "object" && v !== null && "size" in v && (v as File).size > 0);
}
