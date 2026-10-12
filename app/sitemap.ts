import type { MetadataRoute } from "next";
import { products } from "@/lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/shop",
    "/hunt",
    "/categories",
    "/about",
    "/contact",
    "/cart",
    "/checkout",
    "/account",
    "/wishlist",
    "/faq",
  ].map((path) => ({
    url: `https://spockshop.com${path}`,
    lastModified: new Date(),
  }));

  const productPages = products.map((product) => ({
    url: `https://spockshop.com/shop/${product.slug}`,
    lastModified: new Date(product.updatedAt),
  }));

  return [...staticPages, ...productPages];
}
