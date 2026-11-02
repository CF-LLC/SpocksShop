import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/checkout", "/drop/success"],
    },
    sitemap: "https://spockshop.com/sitemap.xml",
  };
}
