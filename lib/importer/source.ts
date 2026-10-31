import type { DepopListing } from "@/lib/depop/parse";
import { parseDepopListing } from "@/lib/depop/parse";
import { isAllowedPhotoUrl, normalizeDepopUrl, type LinkCheck } from "@/lib/depop/url";
import { parseVintedListing } from "@/lib/vinted/parse";
import { isAllowedVintedPhotoUrl, normalizeVintedUrl } from "@/lib/vinted/url";

/** Shared listing importer: each marketplace plugs in its link rules, page parser and photo hosts. */
export type SourceId = "depop" | "vinted";
export type Listing = DepopListing;
export type SourceAdapter = {
  id: SourceId;
  /** Shown in admin only (never on public pages). */
  label: string;
  normalize(input: string): LinkCheck;
  parse(html: string): Listing;
  isAllowedPhotoUrl(url: string): boolean;
};

export const DEPOP: SourceAdapter = { id: "depop", label: "Depop", normalize: normalizeDepopUrl, parse: parseDepopListing, isAllowedPhotoUrl };
export const VINTED: SourceAdapter = { id: "vinted", label: "Vinted", normalize: normalizeVintedUrl, parse: parseVintedListing, isAllowedPhotoUrl: isAllowedVintedPhotoUrl };
export const SOURCES: Record<SourceId, SourceAdapter> = { depop: DEPOP, vinted: VINTED };
