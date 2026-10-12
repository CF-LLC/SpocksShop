import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

export const MEDIA_DIR = process.env.MEDIA_DIR ?? "/var/spocks/media";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 8;

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

/** Save an uploaded photo under MEDIA_DIR/<folder>/ and return its relative storage path. */
export async function savePhoto(file: File, folder: string): Promise<string> {
  const ext = validatePhoto(file);
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "");
  const relative = `${safeFolder}/${randomBytes(12).toString("hex")}.${ext}`;
  const full = resolveMediaPath(relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
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
