import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF first: listing photos are the heaviest thing on most pages.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Listing photos served from Convex file storage.
      {
        protocol: "https",
        hostname: "**.convex.cloud",
        pathname: "/api/storage/**",
      },
    ],
  },
};

export default nextConfig;
