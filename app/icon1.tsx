import { renderIconPng } from "@/lib/brand/render";

// PNG fallback next to app/icon.svg for browsers without SVG favicon support.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return renderIconPng(32);
}
