import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@gdp/core",
    "@gdp/db",
    "@gdp/design-dna",
    "@gdp/design-schema",
    "@gdp/fonts",
    "@gdp/layout-engine",
    "@gdp/planner",
    "@gdp/qa",
    "@gdp/renderer",
    "@gdp/retrieval",
    "@gdp/storage",
    "@gdp/typography",
  ],
  serverExternalPackages: [
    "@resvg/resvg-js",
    "fontkit",
    "sharp",
    "pdfkit",
    "pg",
    "stripe",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(process.cwd(), "src"),
    };
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

export default nextConfig;
