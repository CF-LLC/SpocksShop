import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { shippingRates } from "@/lib/db/schema";
import type { ShippingRateRow } from "./shipping";

/** Active weight-table rows used by checkout. Empty on a read error so storefront pages still render. */
export async function listActiveShippingRates(): Promise<ShippingRateRow[]> {
  try {
    return await db
      .select()
      .from(shippingRates)
      .where(eq(shippingRates.isActive, true))
      .orderBy(asc(shippingRates.minWeightLb));
  } catch {
    return [];
  }
}
