/**
 * Remove the 14 placeholder products from the original seed.
 *   DRY RUN (default):  tsx scripts/remove-sample-products.mts
 *   APPLY:              tsx scripts/remove-sample-products.mts --apply
 * Matches on seed SKU AND slug (source = closet). Never touches a product referenced by any order line.
 * Deleting a product cascades to its inventory and photo rows.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { planSampleRemoval, SEEDED_SAMPLE_PRODUCTS } from "../lib/sample-products";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });
const { products, orderItems } = schema;

async function candidates(tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  return tx
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      title: products.title,
      source: products.source,
      orderLines: sql<number>`(select count(*)::int from ${orderItems} where ${orderItems.productId} = ${products.id})`,
    })
    .from(products)
    .where(inArray(products.sku, SEEDED_SAMPLE_PRODUCTS.map((p) => p.sku)));
}

try {
  if (!apply) {
    const plan = planSampleRemoval(await candidates(db));
    console.log(`DRY RUN: would remove ${plan.remove.length} sample product(s):`);
    for (const r of plan.remove) console.log(`  - ${r.sku}  ${r.slug}  "${r.title}"  (${r.id})`);
    if (plan.keep.length) {
      console.log(`Refusing ${plan.keep.length} product(s) referenced by orders:`);
      for (const r of plan.keep) console.log(`  ! ${r.sku}  ${r.slug}  (${r.orderLines} order line(s))`);
    }
    console.log("Nothing was changed. Re-run with --apply to delete.");
  } else {
    const removed = await db.transaction(async (tx) => {
      // Lock matched rows, then re-check orders inside the transaction.
      await tx.execute(sql`select id from products where sku in ${SEEDED_SAMPLE_PRODUCTS.map((p) => p.sku)} for update`);
      const plan = planSampleRemoval(await candidates(tx));
      for (const r of plan.keep) console.log(`  ! keeping ${r.sku} (${r.orderLines} order line(s))`);
      const ids = plan.remove.map((r) => r.id);
      if (!ids.length) return [];
      return tx.delete(products).where(and(inArray(products.id, ids), eq(products.source, "closet"))).returning({ sku: products.sku, slug: products.slug });
    });
    console.log(`Removed ${removed.length} sample product(s): ${removed.map((r) => r.sku).join(", ") || "none"}`);
  }
} finally {
  await client.end();
}
