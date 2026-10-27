import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeOS — your life, organized",
    short_name: "LifeOS",
    description:
      "Documents, receipts, warranties, expiry dates and reminders in one private place.",
    id: "/",
    start_url: "/home/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6fa",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Add anything", short_name: "Add", url: "/capture/" },
      { name: "Scan a receipt", short_name: "Receipt", url: "/receipts/new/" },
      { name: "Alerts", short_name: "Alerts", url: "/alerts/" },
    ],
  };
}
