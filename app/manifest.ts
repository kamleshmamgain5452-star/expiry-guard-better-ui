import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExpiryGuard",
    short_name: "ExpiryGuard",
    description: "Smart product freshness scanner",
    start_url: "/",
    display: "standalone",
    background_color: "#f6faf8",
    theme_color: "#27a981",
    orientation: "portrait",
    categories: ["food", "health", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
