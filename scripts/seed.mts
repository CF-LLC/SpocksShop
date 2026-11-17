import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import {
  BUNDLE_BRAND,
  BUNDLE_CONDITION,
  BUNDLE_CONDITION_NOTES,
  BUNDLE_IMAGE,
  BUNDLE_PRICE_CENTS,
  BUNDLE_SIZES,
  BUNDLE_WEIGHT_LB,
  bundleDescription,
  bundleTitle,
} from "../lib/shop/closet-bundle";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

// Real data only: no sample categories or products. Closet items are added in /admin/closet.
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

const clothing = (await db.select().from(schema.categories).where(eq(schema.categories.slug, "clothing")))[0];
const image = { ...BUNDLE_IMAGE };

for (const size of BUNDLE_SIZES) {
  const fields = {
    title: bundleTitle(size.size),
    description: bundleDescription(size.size),
    categoryId: clothing?.id ?? null,
    brand: BUNDLE_BRAND,
    condition: BUNDLE_CONDITION,
    conditionNotes: BUNDLE_CONDITION_NOTES,
    priceCents: BUNDLE_PRICE_CENTS,
    originalPriceCents: null,
    weightLb: String(BUNDLE_WEIGHT_LB),
    uniqueFind: false,
    source: "closet" as const,
    status: "listed" as const,
    featured: false,
    requiresApproval: false,
    images: [image],
  };
  const existing = (await db.select().from(schema.products).where(eq(schema.products.sku, size.sku)))[0];
  if (!existing) {
    await db.insert(schema.products).values({ id: size.id, sku: size.sku, slug: size.slug, ...fields });
    await db.insert(schema.inventory).values({ productId: size.id, quantityOnHand: 10, quantityReserved: 0, quantitySold: 0 });
  } else {
    await db.update(schema.products).set({ ...fields, updatedAt: new Date() }).where(eq(schema.products.id, existing.id));
    const inv = (await db.select().from(schema.inventory).where(eq(schema.inventory.productId, existing.id)))[0];
    if (!inv) {
      await db.insert(schema.inventory).values({ productId: existing.id, quantityOnHand: 10, quantityReserved: 0, quantitySold: 0 });
    }
  }
}

console.log("seed complete: shipping rates, tax placeholder, and closet bundle box ensured");
await client.end();
