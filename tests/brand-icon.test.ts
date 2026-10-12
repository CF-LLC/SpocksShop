import { describe, expect, it } from "vitest";
import { iconDataUri, iconSvg, pngToIco } from "../lib/brand/icon";

describe("brand icon", () => {
  it("builds the rounded and maskable variants", () => {
    expect(iconSvg()).toContain('rx="112"');
    expect(iconSvg({ maskable: true })).toContain("scale(0.8)");
    expect(iconDataUri()).toMatch(/^data:image\/svg\+xml;base64,/);
  });
  it("wraps a PNG in a valid ICO header", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const ico = pngToIco(png, 32);
    const v = new DataView(ico.buffer);
    expect([v.getUint16(0, true), v.getUint16(2, true), v.getUint16(4, true)]).toEqual([0, 1, 1]);
    expect(ico[6]).toBe(32);
    expect(v.getUint32(14, true)).toBe(png.length);
    expect(v.getUint32(18, true)).toBe(22);
    expect(Array.from(ico.slice(22))).toEqual(Array.from(png));
  });
});
