import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old pages from the first design point somewhere useful instead of 404ing.
  async redirects() {
    return [
      { source: "/hunt", destination: "/about", permanent: true },
      { source: "/faq", destination: "/about", permanent: true },
      { source: "/categories", destination: "/shop", permanent: true },
      { source: "/wishlist", destination: "/shop", permanent: true },
      { source: "/account", destination: "/shop", permanent: true },
      { source: "/cart", destination: "/checkout", permanent: false },
    ];
  },
};

export default nextConfig;
