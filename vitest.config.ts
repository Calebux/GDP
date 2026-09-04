import { defineConfig } from "vitest/config";
import path from "node:path";

const PACKAGES = [
  "core",
  "design-schema",
  "fonts",
  "typography",
  "layout-engine",
  "renderer",
  "design-dna",
  "planner",
  "qa",
  "retrieval",
  "db",
  "storage",
] as const;

/**
 * Vite aliases are prefix/regex matches, not glob patterns — a "*" in the
 * replacement string is taken literally, so the old "@gdp/x/*" entries never
 * matched anything and subpath imports fell through to node resolution.
 *
 * Subpath entries must come first: a bare "@gdp/core" prefix match would
 * otherwise swallow "@gdp/core/paths" and rewrite it to index.ts/paths.
 */
const alias = [
  ...PACKAGES.map((name) => ({
    find: new RegExp(`^@gdp/${name}/(.*)$`),
    replacement: path.resolve(__dirname, `packages/${name}/src/$1`),
  })),
  ...PACKAGES.map((name) => ({
    find: new RegExp(`^@gdp/${name}$`),
    replacement: path.resolve(__dirname, `packages/${name}/src/index.ts`),
  })),
  { find: /^@gdp\/web\/(.*)$/, replacement: path.resolve(__dirname, "apps/web/src/$1") },
  { find: /^@gdp\/web$/, replacement: path.resolve(__dirname, "apps/web/src/index.ts") },
  { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "apps/web/src/$1") },
];

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60000,
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
  },
  resolve: {
    alias,
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
});
