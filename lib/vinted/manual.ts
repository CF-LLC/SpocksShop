import { priceToCents, mapCondition, type DepopListing } from "@/lib/depop/parse";
import { normalizeVintedUrl } from "./url";

export type ManualInput = { url: string; title: string; price: string; size?: string; condition?: string; description?: string };
export type ManualCheck = { ok: true; url: string; listing: DepopListing } | { ok: false; error: string };

/** Fallback when Vinted blocks the server: Cooper types title + price (+ photos) for a pasted item link. */
export function manualListing(i: ManualInput): ManualCheck {
  const u = normalizeVintedUrl(i.url);
  if (!u.ok) return u;
  const title = i.title.trim().slice(0, 200);
  if (!title) return { ok: false, error: "Add a title." };
  const priceCents = priceToCents(i.price);
  if (priceCents == null) return { ok: false, error: "Add a price, like 13 or 13.50." };
  const conditionLabel = i.condition?.trim().slice(0, 40) || null;
  return {
    ok: true,
    url: u.url,
    listing: { title, description: (i.description ?? "").trim().slice(0, 8000), priceCents, currency: "USD", size: i.size?.trim().slice(0, 40) || null, condition: mapCondition(conditionLabel), conditionLabel, brand: null, photos: [], sold: false },
  };
}
