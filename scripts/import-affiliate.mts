/**
 * Import Amazon picks into affiliate_items.
 *   npx tsx scripts/import-affiliate.mts <file.json> [--dry-run] [--skip-existing]
 * --skip-existing: picks whose ASIN/link is already in the DB are left untouched and listed.
 * In production:  docker compose -p spockshop exec -T app npx tsx scripts/import-affiliate.mts - < picks.json
 * ("-" reads JSON from stdin). Links are normalised to https://www.amazon.com/dp/<ASIN>?tag=mrspock-20.
 */
import fs from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { parseAffiliateBatch } from "../lib/affiliate/import";
import { applyAffiliateImport } from "../lib/affiliate/import-db";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipExisting = args.includes("--skip-existing");
const file = args.find((a) => !a.startsWith("--"));
if (!file) { console.error("usage: import-affiliate.mts <file.json|-> [--dry-run]"); process.exit(2); }
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is required"); process.exit(2); }

const text = file === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(file, "utf8");
let json: unknown;
try { json = JSON.parse(text); } catch (e) { console.error(`Invalid JSON: ${(e as Error).message}`); process.exit(1); }

const parsed = parseAffiliateBatch(json);
if (!parsed.ok) { console.error("Validation failed:\n- " + parsed.errors.join("\n- ")); process.exit(1); }

const client = postgres(url, { max: 1 });
try {
  const db = drizzle(client, { schema });
  const s = await applyAffiliateImport(db, parsed.rows, { dryRun, skipExisting });
  console.log(`${dryRun ? "[dry run] " : ""}${parsed.rows.length} picks: ${s.inserted} inserted, ${s.updated} updated, ${s.skipped} skipped`);
  for (const t of s.titles.skipped) console.log(`  skipped (already in DB): ${t}`);
} finally {
  await client.end();
}
