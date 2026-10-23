import { eq } from "drizzle-orm";
import { z } from "zod";
import { orderItems, products, shipFromAddresses } from "@/lib/db/schema";
import type { Database } from "@/lib/checkout/db";
import type { ShipAddress } from "./config";

export type Owner = { userId: string } | { sellerId: string };

export const shipFromSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  street1: z.string().trim().min(1, "Street is required.").max(150),
  street2: z.string().trim().max(150).optional().transform((v) => v || null),
  city: z.string().trim().min(1, "City is required.").max(80),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use the 2-letter state code."),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "ZIP must be 5 digits (or ZIP+4)."),
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
});
export type ShipFromInput = z.infer<typeof shipFromSchema>;

const where = (o: Owner) => ("userId" in o ? eq(shipFromAddresses.userId, o.userId) : eq(shipFromAddresses.sellerId, o.sellerId));

export async function getShipFrom(db: Database, owner: Owner) {
  const [row] = await db.select().from(shipFromAddresses).where(where(owner));
  return row ?? null;
}

export async function saveShipFrom(db: Database, owner: Owner, input: ShipFromInput) {
  const values = { ...input, updatedAt: new Date() };
  const existing = await getShipFrom(db, owner);
  if (existing) await db.update(shipFromAddresses).set(values).where(eq(shipFromAddresses.id, existing.id));
  else await db.insert(shipFromAddresses).values({ ...values, ...owner });
}

export function toShipAddress(r: typeof shipFromAddresses.$inferSelect): ShipAddress {
  return { name: r.name, street1: r.street1, ...(r.street2 ? { street2: r.street2 } : {}), city: r.city, state: r.state, zip: r.zip, country: "US", ...(r.phone ? { phone: r.phone } : {}) };
}

export type FromResult = { ok: true; address: ShipAddress; owner: Owner } | { ok: false; error: string; owner: Owner | null };

/**
 * The selling account for an order: the community seller if its items are seller-listed,
 * otherwise the shop (the signed-in admin account). Orders mixing sellers are blocked.
 */
export async function resolveShipFrom(db: Database, orderId: string, adminUserId: string | null): Promise<FromResult> {
  const rows = await db.select({ sellerId: products.sellerId, source: products.source }).from(orderItems).leftJoin(products, eq(products.id, orderItems.productId)).where(eq(orderItems.orderId, orderId));
  const sellerIds = [...new Set(rows.filter((r) => r.source === "community" && r.sellerId).map((r) => r.sellerId as string))];
  if (sellerIds.length > 1 || (sellerIds.length === 1 && rows.some((r) => r.source !== "community"))) return { ok: false, owner: null, error: "This order has items from more than one seller; ship them separately." };
  const owner: Owner | null = sellerIds.length ? { sellerId: sellerIds[0] } : adminUserId ? { userId: adminUserId } : null;
  if (!owner) return { ok: false, owner: null, error: "No selling account for this order." };
  const row = await getShipFrom(db, owner);
  if (!row) return { ok: false, owner, error: "sellerId" in owner ? "The seller hasn't saved a return address yet." : "Save your return address in Settings before buying labels." };
  return { ok: true, owner, address: toShipAddress(row) };
}
