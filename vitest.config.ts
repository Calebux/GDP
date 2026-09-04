import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60000,
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
  },
  resolve: {
    alias: {
      "@/": `${path.resolve(__dirname, "apps/web/src")}/`,
      "@gdp/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@gdp/core/*": path.resolve(__dirname, "packages/core/src/*"),
      "@gdp/design-schema": path.resolve(__dirname, "packages/design-schema/src/index.ts"),
      "@gdp/design-schema/*": path.resolve(__dirname, "packages/design-schema/src/*"),
      "@gdp/fonts": path.resolve(__dirname, "packages/fonts/src/index.ts"),
      "@gdp/fonts/*": path.resolve(__dirname, "packages/fonts/src/*"),
      "@gdp/typography": path.resolve(__dirname, "packages/typography/src/index.ts"),
      "@gdp/layout-engine": path.resolve(__dirname, "packages/layout-engine/src/index.ts"),
      "@gdp/renderer": path.resolve(__dirname, "packages/renderer/src/index.ts"),
      "@gdp/design-dna": path.resolve(__dirname, "packages/design-dna/src/index.ts"),
      "@gdp/planner": path.resolve(__dirname, "packages/planner/src/index.ts"),
      "@gdp/planner/*": path.resolve(__dirname, "packages/planner/src/*"),
      "@gdp/qa": path.resolve(__dirname, "packages/qa/src/index.ts"),
      "@gdp/retrieval": path.resolve(__dirname, "packages/retrieval/src/index.ts"),
      "@gdp/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@gdp/db/*": path.resolve(__dirname, "packages/db/src/*"),
      "@gdp/storage": path.resolve(__dirname, "packages/storage/src/index.ts"),
      "@gdp/web": path.resolve(__dirname, "apps/web/src/index.ts"),
      "@gdp/web/*": path.resolve(__dirname, "apps/web/src/*"),
    },
  },
});
