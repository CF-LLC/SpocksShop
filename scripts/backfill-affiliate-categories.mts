/**
 * Backfill affiliate_items.category for existing Amazon Picks. UPDATE only, never deletes.
 *   npx tsx scripts/backfill-affiliate-categories.mts            # dry run (default): prints the plan
 *   npx tsx scripts/backfill-affiliate-categories.mts --apply    # writes it
 *   add --overwrite to also change rows that already have a category.
 * Rule: necessities ASINs are listed explicitly; any other title mentioning Star Trek/Spock/Klingon → star-trek.
 * (The one-time Star Trek move for existing rows is drizzle/0006_star_trek_category.sql.)
 * Anything not matched is reported and left NULL (shows under "All").
 */
import postgres from "postgres";

const NECESSITIES = new Set(["B0DF8RSVJK", "B00QIT9NDW", "B01BNEWDFQ", "B00NTCH52W", "B099F558S1", "B08573DQ39"]);
const TREK_RE = /star\s*trek|spock|klingon|starfleet|enterprise/i;

const apply = process.argv.includes("--apply");
const overwrite = process.argv.includes("--overwrite");
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is required"); process.exit(2); }
const sql = postgres(url, { max: 1 });
try {
  const rows = await sql<{ id: string; asin: string | null; title: string; category: string | null }[]>`select id, asin, title, category from affiliate_items order by sort_order, title`;
  const plan: { id: string; title: string; from: string | null; to: string }[] = [];
  const unmatched: string[] = [];
  for (const r of rows) {
    const to = r.asin && NECESSITIES.has(r.asin) ? "necessities" : TREK_RE.test(r.title) ? "star-trek" : null;
    if (!to) { unmatched.push(`${r.asin ?? "-"}  ${r.title}`); continue; }
    if (r.category === to || (r.category && !overwrite)) continue;
    plan.push({ id: r.id, title: r.title, from: r.category, to });
  }
  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${rows.length} picks, ${plan.length} to update, ${unmatched.length} unmatched`);
  for (const p of plan) console.log(`  ${p.to.padEnd(11)} ← ${p.from ?? "NULL"}  ${p.title.slice(0, 80)}`);
  for (const u of unmatched) console.log(`  (unmatched, left as-is) ${u.slice(0, 90)}`);
  if (apply && plan.length) {
    await sql.begin(async (tx) => { for (const p of plan) await tx`update affiliate_items set category = ${p.to}, updated_at = now() where id = ${p.id}`; });
    console.log(`updated ${plan.length} rows`);
  } else if (!apply) console.log("No changes written. Re-run with --apply.");
} finally { await sql.end(); }
