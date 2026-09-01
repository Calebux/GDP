import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createLogger, env } from "@gdp/core";
import { CATALOGUE_BY_FAMILY, FONT_CATALOGUE, type FontFamilyMeta } from "./catalogue.js";

const log = createLogger("fonts");

export interface FontFile {
  family: string;
  weight: number;
  italic: boolean;
  path: string;
}

export const familySlug = (family: string): string => family.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function fileName(family: string, weight: number, italic: boolean): string {
  return `${familySlug(family)}-${weight}${italic ? "-italic" : ""}.ttf`;
}

export function familyDir(family: string, root = env().FONT_DIR): string {
  return path.resolve(root, familySlug(family));
}

export function fontFilePath(
  family: string,
  weight: number,
  italic = false,
  root = env().FONT_DIR,
): string {
  return path.join(familyDir(family, root), fileName(family, weight, italic));
}

let cache: Map<string, FontFile[]> | null = null;

/** Scan the font directory once. Call `refreshFontIndex()` after `fonts:sync`. */
export function fontIndex(root = env().FONT_DIR): Map<string, FontFile[]> {
  if (cache) return cache;
  const index = new Map<string, FontFile[]>();
  const abs = path.resolve(root);
  if (!existsSync(abs)) {
    log.warn(`font directory missing — run "npm run fonts:sync"`, { dir: abs });
    cache = index;
    return index;
  }
  for (const meta of FONT_CATALOGUE) {
    const dir = familyDir(meta.family, root);
    if (!existsSync(dir)) continue;
    const files: FontFile[] = [];
    for (const entry of readdirSync(dir)) {
      const m = /^(.*)-(\d{3})(-italic)?\.(ttf|otf)$/.exec(entry);
      if (!m) continue;
      files.push({
        family: meta.family,
        weight: Number(m[2]),
        italic: Boolean(m[3]),
        path: path.join(dir, entry),
      });
    }
    if (files.length > 0) index.set(meta.family, files.sort((a, b) => a.weight - b.weight));
  }
  cache = index;
  return index;
}

export function refreshFontIndex(): void {
  cache = null;
}

export function isAvailable(family: string): boolean {
  return (fontIndex().get(family)?.length ?? 0) > 0;
}

export function availableFamilies(): string[] {
  return [...fontIndex().keys()];
}

export function familyMeta(family: string): FontFamilyMeta | undefined {
  return CATALOGUE_BY_FAMILY.get(family);
}

/**
 * §64 — an unavailable family is replaced by the closest approved alternative
 * rather than failing the render. Match on category first, then width.
 */
export function fallbackFor(family: string): string {
  const wanted = CATALOGUE_BY_FAMILY.get(family);
  const available = availableFamilies();
  if (available.length === 0) return "Inter";
  if (!wanted) return available.includes("Inter") ? "Inter" : available[0]!;

  const scored = available
    .map((f) => {
      const meta = CATALOGUE_BY_FAMILY.get(f);
      if (!meta) return { f, score: -1 };
      let score = 0;
      if (meta.category === wanted.category) score += 3;
      if (meta.width === wanted.width) score += 2;
      score += meta.personality.filter((p) => wanted.personality.includes(p)).length;
      if (meta.roles.some((r) => wanted.roles.includes(r))) score += 1;
      return { f, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.f ?? "Inter";
}

/** Nearest available weight — heavy display faces often ship a single weight. */
export function resolveFont(family: string, weight = 400, italic = false): FontFile | null {
  const index = fontIndex();
  const files = index.get(family) ?? index.get(fallbackFor(family));
  if (!files || files.length === 0) return null;

  const preferred = files.filter((f) => f.italic === italic);
  const pool = preferred.length > 0 ? preferred : files;
  let best = pool[0]!;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const file of pool) {
    const delta = Math.abs(file.weight - weight);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = file;
    }
  }
  return best;
}

export function allFontFiles(): string[] {
  return [...fontIndex().values()].flat().map((f) => f.path);
}

/** @font-face rules so the browser editor measures text exactly as the server does. */
export function fontFaceCss(publicBase = "/api/fonts"): string {
  return [...fontIndex().values()]
    .flat()
    .map(
      (f) => `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:${
        f.italic ? "italic" : "normal"
      };font-display:block;src:url('${publicBase}/${familySlug(f.family)}/${path.basename(
        f.path,
      )}') format('truetype');}`,
    )
    .join("\n");
}
