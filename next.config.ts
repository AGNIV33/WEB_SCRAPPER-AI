import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "axe-core"],
  outputFileTracingIncludes: {
    "/api/page": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/discover": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
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
