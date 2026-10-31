import { readFile } from "fs/promises";
import path from "path";
import { dropEnabled, DESIGNS, isHeld } from "@/lib/drop/config";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
const ALLOWED = new Set(DESIGNS.flatMap((d) => [`${d.file}.png`, `${d.file}.webp`]));

/** Art is only reachable while the drop is on (print .png for Printful, .webp previews). */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!dropEnabled() || !ALLOWED.has(file)) return new Response("Not found", { status: 404 });
  const d = DESIGNS.find((x) => file.startsWith(`${x.file}.`));
  const held = !!d && isHeld(d.slug);
  if (held && (await getSession().catch(() => null))?.role !== "admin") return new Response("Not found", { status: 404 });
  const dir = file.endsWith(".png") ? "print" : "preview";
  try {
    const buf = await readFile(path.join(process.cwd(), "drop-art", dir, file));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": file.endsWith(".png") ? "image/png" : "image/webp", "Cache-Control": held ? "private, no-store" : "public, max-age=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
