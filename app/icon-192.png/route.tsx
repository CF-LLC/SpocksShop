import { renderIconPng } from "@/lib/brand/render";

export const dynamic = "force-static";

export function GET() {
  return renderIconPng(192);
}
