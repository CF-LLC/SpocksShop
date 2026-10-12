import { pngToIco } from "@/lib/brand/icon";
import { renderIconPng } from "@/lib/brand/render";

export const dynamic = "force-static";

export async function GET() {
  const png = new Uint8Array(await renderIconPng(32).arrayBuffer());
  return new Response(pngToIco(png, 32).buffer as ArrayBuffer, {
    headers: { "content-type": "image/x-icon", "cache-control": "public, max-age=86400" },
  });
}
