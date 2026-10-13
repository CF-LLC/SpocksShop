import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";

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

console.log("seed complete: shipping rates and tax placeholder ensured");
await client.end();
