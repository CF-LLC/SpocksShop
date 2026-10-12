import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "staff"] }).notNull().default("admin"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const customers = pgTable("customers", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const addresses = pgTable("addresses", {
  id: id(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // shipping | billing | pickup
  name: text("name"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull().default("US"),
  createdAt: createdAt(),
});

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: createdAt(),
});

export const products = pgTable("products", {
  id: id(),
  sku: text("sku").notNull().unique(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  brand: text("brand"),
  condition: text("condition").notNull(),
  conditionNotes: text("condition_notes"),
  priceCents: integer("price_cents").notNull(),
  originalPriceCents: integer("original_price_cents"),
  purchaseCostCents: integer("purchase_cost_cents"), // admin-only
  weightLb: numeric("weight_lb", { precision: 8, scale: 2 }),
  uniqueFind: boolean("unique_find").notNull().default(true),
  status: text("status").notNull().default("draft"),
  featured: boolean("featured").notNull().default(false),
  images: jsonb("images").notNull().default(sql`'[]'::jsonb`),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const inventory = pgTable(
  "inventory",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .unique()
      .references(() => products.id, { onDelete: "cascade" }),
    quantityOnHand: integer("quantity_on_hand").notNull().default(1),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    quantitySold: integer("quantity_sold").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("inventory_reserved_lte_on_hand", sql`${t.quantityReserved} <= ${t.quantityOnHand}`),
    check("inventory_non_negative", sql`${t.quantityOnHand} >= 0 and ${t.quantityReserved} >= 0 and ${t.quantitySold} >= 0`),
  ],
);

export const shippingRates = pgTable("shipping_rates", {
  id: id(),
  name: text("name").notNull(),
  minWeightLb: numeric("min_weight_lb", { precision: 8, scale: 2 }).notNull(),
  maxWeightLb: numeric("max_weight_lb", { precision: 8, scale: 2 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const taxRates = pgTable("tax_rates", {
  id: id(),
  jurisdiction: text("jurisdiction").notNull(),
  appliesTo: text("applies_to").notNull(), // pickup | destination | both
  state: text("state").notNull(),
  city: text("city"),
  postalCode: text("postal_code"),
  rate: numeric("rate", { precision: 8, scale: 6 }).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  expiresAt: date("expires_at"),
  sourceReference: text("source_reference"),
  isActive: boolean("is_active").notNull().default(true),
  verifiedWithAuthority: boolean("verified_with_authority").notNull().default(false),
  createdAt: createdAt(),
});

export const orders = pgTable("orders", {
  id: id(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  salesChannel: text("sales_channel").notNull().default("website"),
  status: text("status").notNull().default("pending"),
  fulfillmentMethod: text("fulfillment_method"), // pickup | ship
  shippingAddressId: uuid("shipping_address_id").references(() => addresses.id, { onDelete: "set null" }),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  shippingCents: integer("shipping_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  taxSnapshot: jsonb("tax_snapshot"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  titleSnapshot: text("title_snapshot").notNull(),
  skuSnapshot: text("sku_snapshot").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  paymentProvider: text("payment_provider").notNull(), // stripe | btcpay
  paymentStatus: text("payment_status").notNull().default("pending"),
  providerPaymentId: text("provider_payment_id"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const refunds = pgTable("refunds", {
  id: id(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason"),
  providerRefundId: text("provider_refund_id"),
  status: text("status").notNull().default("pending"),
  createdAt: createdAt(),
});

export const adminNotes = pgTable("admin_notes", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});
