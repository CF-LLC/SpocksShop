import { describe, expect, it } from "vitest";
import { sniffImage, validatePhoto } from "../lib/media";
import { autoSku, parseClosetForm } from "../lib/admin/forms";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

describe("media type limits", () => {
  it("sniffs real image bytes, not the declared type", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
  it("rejects wrong types and oversize files", () => {
    expect(() => validatePhoto({ type: "image/svg+xml", size: 10 })).toThrow();
    expect(() => validatePhoto({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toThrow();
    expect(validatePhoto({ type: "image/webp", size: 1000 })).toBe("webp");
  });
});

describe("closet form", () => {
  it("auto-generates a SKU when left blank", () => {
    expect(autoSku(new Date("2026-10-13T12:00:00Z"))).toMatch(/^SRS-261013-[0-9A-F]{4}$/);
    const { product } = parseClosetForm(fd({ title: "Brass lamp", sku: "", description: "", condition: "Good", price: "25", quantity: "1", status: "draft" }));
    expect(product.sku).toMatch(/^SRS-\d{6}-[0-9A-F]{4}$/);
    expect(product.priceCents).toBe(2500);
  });
  it("keeps an explicit SKU", () => {
    const { product } = parseClosetForm(fd({ title: "Brass lamp", sku: "abc-1", description: "", condition: "Good", price: "25", quantity: "1", status: "listed" }));
    expect(product.sku).toBe("ABC-1");
    expect(product.status).toBe("listed");
  });
});
