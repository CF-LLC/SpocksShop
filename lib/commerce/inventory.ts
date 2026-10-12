import { eq, sql } from "drizzle-orm";
import type { db as Db } from "../db";
import { inventory } from "../db/schema";

export function availableQuantity(row: { quantityOnHand: number; quantityReserved: number }): number {
  return Math.max(0, row.quantityOnHand - row.quantityReserved);
}

export class InsufficientInventoryError extends Error {
  constructor(productId: string) {
    super(`Not enough available inventory for product ${productId}`);
    this.name = "InsufficientInventoryError";
  }
}

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

async function lockRow(tx: Tx, productId: string) {
  const [row] = await tx
    .select()
    .from(inventory)
    .where(eq(inventory.productId, productId))
    .for("update");
  if (!row) throw new InsufficientInventoryError(productId);
  return row;
}

/** Reserve stock with SELECT … FOR UPDATE to prevent overselling. */
export async function reserveInventory(database: typeof Db, productId: string, quantity = 1) {
  return database.transaction(async (tx) => {
    const row = await lockRow(tx, productId);
    if (availableQuantity(row) < quantity) throw new InsufficientInventoryError(productId);
    await tx
      .update(inventory)
      .set({ quantityReserved: sql`${inventory.quantityReserved} + ${quantity}`, updatedAt: new Date() })
      .where(eq(inventory.productId, productId));
  });
}

/** Convert a reservation into a sale. */
export async function commitInventorySale(database: typeof Db, productId: string, quantity = 1) {
  return database.transaction(async (tx) => {
    const row = await lockRow(tx, productId);
    if (row.quantityReserved < quantity) throw new InsufficientInventoryError(productId);
    await tx
      .update(inventory)
      .set({
        quantityReserved: sql`${inventory.quantityReserved} - ${quantity}`,
        quantityOnHand: sql`${inventory.quantityOnHand} - ${quantity}`,
        quantitySold: sql`${inventory.quantitySold} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.productId, productId));
  });
}
