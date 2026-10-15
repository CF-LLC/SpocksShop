import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { isPublished, parseGuide, type Guide } from "./schema";

/** content/guides by default; GUIDES_DIR overrides (local dev samples only). */
export function guidesDir(env: Record<string, string | undefined> = process.env): string {
  return env.GUIDES_DIR?.trim() || path.join(process.cwd(), "content", "guides");
}

export async function loadAllGuides(dir = guidesDir()): Promise<Guide[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const guides: Guide[] = [];
  for (const f of files.sort()) {
    try {
      const g = parseGuide(JSON.parse(await readFile(path.join(dir, f), "utf8")), f);
      if (`${g.slug}.json` !== f) throw new Error(`${f}: slug must match file name`);
      guides.push(g);
    } catch (e) {
      console.error("invalid guide skipped", (e as Error).message);
    }
  }
  return guides;
}

export async function publishedGuides(dir?: string): Promise<Guide[]> {
  return (await loadAllGuides(dir)).filter(isPublished).sort((a, b) => a.title.localeCompare(b.title));
}

/** Drafts are invisible: returns null so the page 404s. */
export async function getPublishedGuide(slug: string, dir?: string): Promise<Guide | null> {
  return (await publishedGuides(dir)).find((g) => g.slug === slug) ?? null;
}
