export const productConditions = ["New", "Like New", "Excellent", "Good", "Fair", "For Parts/Repair"] as const;
export type ProductCondition = (typeof productConditions)[number];

export type ProductStatus = "draft" | "listed" | "reserved" | "sold" | "archived";

export type ProductImage = { id: string; src: string; alt: string; width: number; height: number };

/** A storefront product (closet or community), always read from the database. */
export type Product = {
  id: string;
  sku: string;
  slug: string;
  title: string;
  description: string;
  source: "closet" | "community";
  categoryName: string | null;
  brand: string;
  condition: string;
  conditionNotes: string;
  priceCents: number;
  originalPriceCents: number | null;
  /** Units a shopper can buy right now (on hand minus reserved). */
  available: number;
  images: ProductImage[];
  hasPhotos: boolean;
  weightLb: number;
  sellerName: string | null;
  status: ProductStatus;
  listedAt: string;
};

export type CartLine = { productId: string; quantity: number };

/** What the cart drawer shows; refreshed from /api/cart so prices and stock are never trusted from storage. */
export type CartProduct = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  available: number;
  image: string | null;
  source: "closet" | "community";
  purchasable: boolean;
};
