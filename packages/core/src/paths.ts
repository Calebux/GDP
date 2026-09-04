import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Server-only path helpers.
 *
 * Deliberately NOT re-exported from index.ts: this module imports node:fs, and
 * @gdp/core's barrel is pulled into client bundles (SmartBrief, PACK_FORMATS),
 * where a node: import is a build error.
 */

let rootCache: string | null = null;

/** The workspace root — the directory holding the root package.json. */
export function workspaceRoot(): string {
  if (rootCache) return rootCache;

  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { workspaces?: unknown };
        if (pkg.workspaces) return (rootCache = dir);
      } catch {
        // unreadable package.json — keep walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return (rootCache = process.cwd());
}

/**
 * Resolve a configured path against the repo rather than cwd.
 *
 * Defaults like "./assets/fonts" are relative to the repo, but cwd depends on
 * the entry point: scripts run from the root, `next dev` runs from apps/web.
 * Resolving against cwd sent the app looking for fonts in apps/web/assets/fonts,
 * and a missing font directory does not fail loudly — every text layer renders
 * as nothing, so designs come out blank but still score.
 */
export function resolveFromRoot(configured: string): string {
  return path.isAbsolute(configured) ? configured : path.resolve(workspaceRoot(), configured);
}
