import { clamp } from "@gdp/core";
import { DesignDocument, contentBox } from "./document.js";
import { Layer, isText } from "./layers.js";

export interface Repair {
  layerId: string | null;
  rule: string;
  message: string;
  severity: "info" | "warn";
}

export interface GuardOptions {
  /** Font availability, injected so the schema package stays dependency-light. */
  fontAvailable?: (family: string) => boolean;
  fontFallback?: (family: string) => string;
  /** §17 — nothing smaller than this is legible in print or on a phone. */
  minFontSize?: number;
  /** §17 — no more than this many families unless deliberately overridden. */
  maxFontFamilies?: number;
  /** Allow layers to bleed past the canvas edge (backgrounds, textures). */
  bleedSlots?: string[];
}

const DEFAULT_BLEED_SLOTS = ["background", "texture", "overlay", "backdrop-shape", "decoration"];

/**
 * §64 — "The AI proposes. The engine enforces."
 * Never throws on a recoverable problem: it corrects the document and reports
 * what it changed, so the planner's mistakes cannot reach a customer.
 */
export function enforceGuards(
  input: DesignDocument,
  options: GuardOptions = {},
): { doc: DesignDocument; repairs: Repair[] } {
  const doc = structuredClone(input);
  const repairs: Repair[] = [];
  const minFontSize = options.minFontSize ?? 14;
  const maxFamilies = options.maxFontFamilies ?? 3;
  const bleedSlots = new Set(options.bleedSlots ?? DEFAULT_BLEED_SLOTS);
  const box = contentBox(doc.canvas);

  // 1. Font substitution (§64: "If model references unavailable font, replace it").
  if (options.fontAvailable) {
    for (const layer of doc.layers) {
      if (!isText(layer)) continue;
      if (options.fontAvailable(layer.fontFamily)) continue;
      const replacement = options.fontFallback?.(layer.fontFamily) ?? "Inter";
      repairs.push({
        layerId: layer.id,
        rule: "font-unavailable",
        message: `"${layer.fontFamily}" is not licensed/installed — substituted "${replacement}"`,
        severity: "warn",
      });
      layer.fontFamily = replacement;
    }
  }

  // 2. Font family budget (§17).
  const families = new Set(doc.layers.filter(isText).map((l) => l.fontFamily));
  if (families.size > maxFamilies) {
    const ranked = [...families];
    const keep = new Set(ranked.slice(0, maxFamilies));
    const primary = ranked[0]!;
    for (const layer of doc.layers) {
      if (!isText(layer) || keep.has(layer.fontFamily)) continue;
      repairs.push({
        layerId: layer.id,
        rule: "too-many-fonts",
        message: `${families.size} font families exceeded the budget of ${maxFamilies} — collapsed to "${primary}"`,
        severity: "warn",
      });
      layer.fontFamily = primary;
    }
  }

  // 3. Minimum legible size (§17).
  for (const layer of doc.layers) {
    if (!isText(layer)) continue;
    if (layer.fontSize >= minFontSize) continue;
    repairs.push({
      layerId: layer.id,
      rule: "font-too-small",
      message: `${Math.round(layer.fontSize)}px raised to the ${minFontSize}px legibility floor`,
      severity: "warn",
    });
    layer.fontSize = minFontSize;
  }

  // 4. Keep content inside the canvas (§64: "If object coordinates leave the canvas, correct them").
  for (const layer of doc.layers) {
    if (bleedSlots.has(layer.slot)) continue;
    const corrected = clampToBox(layer, box);
    if (corrected) {
      repairs.push({
        layerId: layer.id,
        rule: "out-of-bounds",
        message: `${layer.slot} was outside the safe content area — pulled back inside`,
        severity: "warn",
      });
    }
  }

  // 5. Unique, dense z-order.
  const ordered = [...doc.layers].sort((a, b) => a.zIndex - b.zIndex);
  ordered.forEach((layer, index) => {
    layer.zIndex = index;
  });

  // 6. Asset references must resolve.
  const known = new Set(doc.assetIds);
  for (const layer of doc.layers) {
    if (layer.type !== "image") continue;
    if (known.size === 0 || known.has(layer.assetId)) continue;
    repairs.push({
      layerId: layer.id,
      rule: "unknown-asset",
      message: `asset "${layer.assetId}" is not attached to this design — layer hidden`,
      severity: "warn",
    });
    layer.visible = false;
  }

  // 7. Opacity/rotation sanity.
  for (const layer of doc.layers) {
    layer.opacity = clamp(layer.opacity, 0, 1);
    layer.rotation = clamp(layer.rotation, -180, 180);
  }

  return { doc, repairs };
}

function clampToBox(
  layer: Layer,
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const maxX = box.x + box.width;
  const maxY = box.y + box.height;
  let changed = false;

  if (layer.width > box.width) {
    layer.width = box.width;
    changed = true;
  }
  if (layer.height > box.height && layer.type !== "text") {
    layer.height = box.height;
    changed = true;
  }
  if (layer.x < box.x) {
    layer.x = box.x;
    changed = true;
  }
  if (layer.y < box.y) {
    layer.y = box.y;
    changed = true;
  }
  if (layer.x + layer.width > maxX) {
    layer.x = maxX - layer.width;
    changed = true;
  }
  if (layer.y + layer.height > maxY) {
    layer.y = maxY - layer.height;
    changed = true;
  }
  return changed;
}

/** Hard failure — used before export, where a repair is no longer acceptable. */
export function assertRenderable(doc: DesignDocument): void {
  const parsed = DesignDocument.safeParse(doc);
  if (!parsed.success) {
    throw new Error(`Design document failed validation: ${JSON.stringify(parsed.error.issues.slice(0, 5))}`);
  }
}
