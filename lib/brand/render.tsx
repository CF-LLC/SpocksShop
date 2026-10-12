import { ImageResponse } from "next/og";
import { iconDataUri } from "@/lib/brand/icon";

/** Render the brand icon to a PNG of the given size. */
export function renderIconPng(size: number, options?: { maskable?: boolean }) {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={iconDataUri(options)} width={size} height={size} alt="" />,
    { width: size, height: size },
  );
}
