import { z } from "zod";
import { productConditions, type ProductCondition } from "@/lib/types";

/** The JSON contract every provider must return. Validated strictly; anything else is rejected. */
export const SUGGESTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short resale listing title, max 80 chars, brand first if known" },
    description: { type: "string", description: "2-4 honest sentences for a resale listing; mention visible flaws" },
    price_usd: { type: "number", description: "Realistic used resale price in USD (not retail)" },
    size: { type: "string", description: "Size if visible on a tag, else empty string" },
    condition: { type: "string", enum: [...productConditions] },
    brand: { type: "string", description: "Brand if visible or obvious, else empty string" },
    material: { type: "string", description: "Material if visible on a tag or obvious, else empty string" },
  },
  required: ["title", "description", "price_usd", "size", "condition", "brand", "material"],
} as const;

const text = (max: number) => z.string().trim().max(max);

export const suggestionSchema = z
  .object({
    title: text(120).min(1),
    description: text(2000),
    price_usd: z.number().finite().min(0).max(100000),
    size: text(60),
    condition: z.string(),
    brand: text(80),
    material: text(80),
  })
  .strict();

export type Suggestion = {
  title: string;
  description: string;
  priceUsd: number;
  size: string;
  condition: ProductCondition;
  brand: string;
  material: string;
};

/** Map loose model wording onto the shop's condition values. */
export function mapCondition(raw: string): ProductCondition {
  const s = raw.trim().toLowerCase();
  const exact = productConditions.find((c) => c.toLowerCase() === s);
  if (exact) return exact;
  if (/parts|repair|broken|not working/.test(s)) return "For Parts/Repair";
  if (/new with|nwt|brand new|sealed|unused/.test(s)) return "New";
  if (/like new|mint|nwot/.test(s)) return "Like New";
  if (/excellent|very good/.test(s)) return "Excellent";
  if (/fair|worn|poor|heavy/.test(s)) return "Fair";
  return "Good";
}

/** Validate raw model output (object or JSON string). Throws on anything off-contract. */
export function parseSuggestion(raw: unknown): Suggestion {
  let value = raw;
  if (typeof raw === "string") {
    const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    value = JSON.parse(t);
  }
  const s = suggestionSchema.parse(value);
  return {
    title: s.title.slice(0, 80),
    description: s.description,
    priceUsd: Math.round(s.price_usd * 100) / 100,
    size: s.size,
    condition: mapCondition(s.condition),
    brand: s.brand,
    material: s.material,
  };
}

export const SUGGESTION_PROMPT = `You are helping list a secondhand item for resale in a small online shop.
Look at the photos (the first one is the cover) and fill in the listing fields.
Rules: be factual; only name a brand, size or material if you can see it or it is unmistakable, otherwise use "".
price_usd is a realistic USED resale price in US dollars, not the retail price.
condition must be exactly one of: ${productConditions.join(", ")}.
Return only the JSON object.`;
