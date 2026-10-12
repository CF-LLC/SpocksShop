import { CONTENT_TYPES, MediaError, readMedia } from "@/lib/media";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const relative = parts.join("/");
  const ext = relative.split(".").pop()?.toLowerCase() ?? "";
  const type = CONTENT_TYPES[ext];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const body = await readMedia(relative);
    return new Response(new Uint8Array(body), {
      headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
    });
  } catch (e) {
    if (e instanceof MediaError) return new Response("Bad request", { status: 400 });
    return new Response("Not found", { status: 404 });
  }
}
