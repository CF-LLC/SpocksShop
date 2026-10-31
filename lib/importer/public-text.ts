/**
 * Imported drafts used to get condition notes like "Depop condition: Used - Excellent". Shoppers must
 * never see the marketplace name, so public pages show "Condition: …" instead (stored data untouched).
 */
export function publicConditionNotes(notes: string | null | undefined): string {
  return (notes ?? "").replace(/^\s*(?:depop|vinted)\s+condition\s*:/i, "Condition:");
}
