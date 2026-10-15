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
  role: text("role", { enum: ["admin", "staff", "seller"] }).notNull().default("admin"),
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

export const itemSources = ["closet", "affiliate", "community"] as const;
export type ItemSource = (typeof itemSources)[number];

export const sellers = pgTable(
  "sellers",
  {
  id: id(),
  // Optional link to a login account.
  userId: uuid("user_id").unique().references(() => users.id, { onDelete: "set null" }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  status: text("status", { enum: ["pending", "active", "suspended"] }).notNull().default("pending"),
  // Payout placeholder only. No Stripe Connect yet.
  payoutMethod: text("payout_method"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  },
  (t) => [check("sellers_status_valid", sql`${t.status} in ('pending', 'active', 'suspended')`)],
);

export const products = pgTable(
  "products",
  {
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
  // Which shop section the item belongs to. Existing products are Cooper's own closet.
  source: text("source", { enum: itemSources }).notNull().default("closet"),
  sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"),
  featured: boolean("featured").notNull().default(false),
  // Checkout only authorizes the card; Cooper accepts (capture) or declines (void) in /admin/orders.
  requiresApproval: boolean("requires_approval").notNull().default(false),
  images: jsonb("images").notNull().default(sql`'[]'::jsonb`),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  },
  (t) => [check("products_source_valid", sql`${t.source} in ('closet', 'affiliate', 'community')`)],
);

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
  // Order approval (manual-capture) fields. See lib/approval.
  requiresApproval: boolean("requires_approval").notNull().default(false),
  paymentIntentId: text("payment_intent_id"),
  customerEmail: text("customer_email"),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
  reminder24hSentAt: timestamp("reminder_24h_sent_at", { withTimezone: true }),
  reminderDay5SentAt: timestamp("reminder_day5_sent_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionReason: text("decision_reason"),
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

export const communityListings = pgTable(
  "community_listings",
  {
  id: id(),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellers.id, { onDelete: "cascade" }),
  // Set once an approved listing is published as a product (source = community).
  productId: uuid("product_id").unique().references(() => products.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  condition: text("condition"),
  priceCents: integer("price_cents").notNull(),
  status: text("status", { enum: ["draft", "pending", "approved", "rejected"] }).notNull().default("draft"),
  moderationNote: text("moderation_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  },
  (t) => [
    check("community_listings_status_valid", sql`${t.status} in ('draft', 'pending', 'approved', 'rejected')`),
    check("community_listings_price_non_negative", sql`${t.priceCents} >= 0`),
  ],
);

export const affiliateItems = pgTable(
  "affiliate_items",
  {
    id: id(),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    amazonUrl: text("amazon_url"),
    asin: text("asin"),
    priceNote: text("price_note"),
    /** Shop filter chip slug, e.g. "spock" | "necessities". Nullable: uncategorised picks show under "All". */
    category: text("category"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("affiliate_items_url_or_asin", sql`${t.amazonUrl} is not null or ${t.asin} is not null`)],
);

export const photos = pgTable(
  "photos",
  {
    id: id(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    communityListingId: uuid("community_listing_id").references(() => communityListings.id, { onDelete: "cascade" }),
    // Path relative to the media volume (/var/spocks/media).
    storagePath: text("storage_path").notNull(),
    alt: text("alt").notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [check("photos_has_owner", sql`${t.productId} is not null or ${t.communityListingId} is not null`)],
);

export const errorLog = pgTable("error_log", {
  id: id(),
  level: text("level", { enum: ["error", "warn", "info"] }).notNull().default("error"),
  source: text("source").notNull(),
  message: text("message").notNull(),
  context: jsonb("context"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Small key/value store for operational status (e.g. last backup), written by scripts/backup.sh. */
export const appStatus = pgTable("app_status", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// ---------- AI listing suggestions: usage + seller entitlements (additive, migration 0004) ----------

/** One row per AI suggestion request (admin or seller). Never stores images or prompts. */
export const aiUsageEvents = pgTable("ai_usage_events", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "set null" }),
  actorRole: text("actor_role").notNull(), // admin | staff | seller
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  imageCount: integer("image_count").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  /** Estimated cost in micro-USD (1e-6 $), from the provider's list price at request time. */
  estCostMicros: integer("est_cost_micros").notNull().default(0),
  status: text("status").notNull(), // ok | error | invalid_output
  billedVia: text("billed_via"), // free_staff | credit | plan
  createdAt: createdAt(),
});

/** Append-only credit ledger per seller. Balance = sum(delta). */
export const aiCreditLedger = pgTable("ai_credit_ledger", {
  id: id(),
  sellerId: uuid("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(), // purchase | use | grant | refund
  /** Stripe Checkout Session id for purchases (unique, so webhook re-deliveries can't double-credit). */
  reference: text("reference").unique(),
  usageEventId: uuid("usage_event_id").references(() => aiUsageEvents.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** Optional monthly AI plan per seller (Stripe subscription). */
export const sellerAiPlans = pgTable("seller_ai_plans", {
  sellerId: uuid("seller_id").primaryKey().references(() => sellers.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("none"), // none | active | past_due | canceled
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  updatedAt: updatedAt(),
});

export const blogPostStatuses = ["draft", "published", "rejected"] as const;
export type BlogPostStatus = (typeof blogPostStatuses)[number];

/** blog.spockshop.com posts. AI writes drafts; nothing is public until an admin approves it. */
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    targetKeyword: text("target_keyword").notNull().default(""),
    /** Normalized keyword used to avoid writing the same topic twice. */
    topicKey: text("topic_key").notNull().default(""),
    kind: text("kind").notNull().default("buying_guide"),
    bodyMd: text("body_md").notNull().default(""),
    affiliateItemIds: jsonb("affiliate_item_ids").$type<string[]>().notNull().default([]),
    status: text("status").$type<BlogPostStatus>().notNull().default("draft"),
    source: text("source").notNull().default("ai"),
    aiModel: text("ai_model"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("blog_posts_status_valid", sql`${t.status} in ('draft', 'published', 'rejected')`)],
);
