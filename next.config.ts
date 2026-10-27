import type { NextConfig } from "next";

// Static export: the UI is a client-side app on Firebase Hosting. All secrets
// and AI calls live in Cloud Functions, never in this bundle.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
