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
    categories: ["food", "health", "productivity"]
  };
}
