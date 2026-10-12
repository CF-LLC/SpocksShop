import { eq, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { affiliateItems } from "../db/schema";
import type * as schema from "../db/schema";
import type { AffiliateRow } from "./import";

export type ImportSummary = { inserted: number; updated: number; titles: { inserted: string[]; updated: string[] } };

/** Upsert by ASIN (or by amazon_url when no ASIN). Only inserts/updates; never deletes. */
export async function applyAffiliateImport(db: PostgresJsDatabase<typeof schema>, rows: AffiliateRow[], opts: { dryRun?: boolean } = {}): Promise<ImportSummary> {
  const summary: ImportSummary = { inserted: 0, updated: 0, titles: { inserted: [], updated: [] } };
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const match = row.asin ? or(eq(affiliateItems.asin, row.asin), eq(affiliateItems.amazonUrl, row.amazonUrl)) : eq(affiliateItems.amazonUrl, row.amazonUrl);
      const [existing] = await tx.select({ id: affiliateItems.id }).from(affiliateItems).where(match).limit(1);
      if (existing) {
        summary.updated++; summary.titles.updated.push(row.title);
        if (!opts.dryRun) await tx.update(affiliateItems).set({ ...row, updatedAt: new Date() }).where(eq(affiliateItems.id, existing.id));
      } else {
        summary.inserted++; summary.titles.inserted.push(row.title);
        if (!opts.dryRun) await tx.insert(affiliateItems).values(row);
      }
    }
  });
  return summary;
}
