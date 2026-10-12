import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { categories as catalogCategories, products as catalogProducts } from "../lib/data";
import { dollarsToCents } from "../lib/commerce/money";
import * as schema from "../lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const catIds = new Map<string, string>();
for (const c of catalogCategories) {
  await db
    .insert(schema.categories)
    .values({ slug: c.slug, name: c.name, description: c.description })
    .onConflictDoNothing({ target: schema.categories.slug });
}
for (const row of await db.select().from(schema.categories)) catIds.set(row.slug, row.id);

let added = 0;
for (const p of catalogProducts) {
  const [row] = await db
    .insert(schema.products)
    .values({
      sku: p.sku,
      slug: p.slug,
      title: p.title,
      description: p.description,
      categoryId: catIds.get(p.category) ?? null,
      brand: p.brand,
      condition: p.condition,
      conditionNotes: p.conditionNotes,
      priceCents: dollarsToCents(p.price),
      originalPriceCents: p.originalPrice != null ? dollarsToCents(p.originalPrice) : null,
      purchaseCostCents: dollarsToCents(p.purchaseCost),
      weightLb: String(p.weightLb),
      uniqueFind: p.quantity <= 1,
      source: "closet",
      status: p.status,
      featured: Boolean(p.featured),
      images: p.images,
      tags: p.tags,
    })
    .onConflictDoNothing({ target: schema.products.sku })
    .returning({ id: schema.products.id });
  if (row) {
    added++;
    await db
      .insert(schema.inventory)
      .values({ productId: row.id, quantityOnHand: p.status === "sold" ? 0 : p.quantity, quantitySold: p.status === "sold" ? p.quantity : 0 })
      .onConflictDoNothing({ target: schema.inventory.productId });
  }
}

if ((await db.select().from(schema.shippingRates)).length === 0) {
  await db.insert(schema.shippingRates).values([
    { name: "Up to 1 lb", minWeightLb: "0", maxWeightLb: "1", amountCents: 599 },
    { name: "1–5 lb", minWeightLb: "1.01", maxWeightLb: "5", amountCents: 999 },
    { name: "5–20 lb", minWeightLb: "5.01", maxWeightLb: "20", amountCents: 1999 },
  ]);
}

if ((await db.select().from(schema.taxRates)).length === 0) {
  // Placeholder only. NOT verified with Arkansas DFA. See docs/tax.md.
  await db.insert(schema.taxRates).values({
    jurisdiction: "Bentonville, AR (placeholder — verify with DFA)",
    appliesTo: "both",
    state: "AR",
    city: "Bentonville",
    rate: "0",
    effectiveFrom: "2026-01-01",
    sourceReference: "UNVERIFIED placeholder",
    verifiedWithAuthority: false,
  });
}

console.log(`seed complete: ${added} new products`);
await client.end();
