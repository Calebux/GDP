import { z } from "zod";
import { type DesignDocument, isImage, isText } from "@gdp/design-schema";

/**
 * §13 — Design DNA. A compact, comparable description of a composition.
 * References and generated designs are both reduced to this, which is what
 * makes retrieval, ranking and "make it feel more premium" tractable.
 */
export const DesignDna = z.object({
  visualWeight: z.object({
    portrait: z.number().min(0).max(1),
    headline: z.number().min(0).max(1),
    secondaryText: z.number().min(0).max(1),
    decorations: z.number().min(0).max(1),
  }),
  composition: z.string(),
  headlineStyle: z.enum([
    "oversized_condensed",
    "oversized_display",
    "editorial_serif",
    "modest_sans",
    "stacked_caps",
    "mixed_case_elegant",
  ]),
  spacing: z.enum(["tight", "balanced", "generous"]),
  energy: z.number().min(0).max(1),
  minimalism: z.number().min(0).max(1),
  contrast: z.number().min(0).max(1),
  /** Ratio of headline size to the next largest text. */
  scaleContrast: z.number().min(1).max(8),
  paletteTemperature: z.enum(["warm", "cool", "neutral"]),
  fontFamilies: z.number().int().min(0).max(6),
  subjectCount: z.number().int().min(0).max(6),
});
export type DesignDna = z.infer<typeof DesignDna>;

export function computeDna(doc: DesignDocument): DesignDna {
  const canvasArea = doc.canvas.width * doc.canvas.height;
  const area = (l: { width: number; height: number }): number => (l.width * l.height) / canvasArea;

  let portrait = 0;
  let headline = 0;
  let secondary = 0;
  let decorations = 0;

  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    if (layer.slot === "subject" || layer.slot === "secondary-subject") portrait += area(layer);
    else if (layer.slot === "headline") headline += area(layer) * 1.4;
    else if (layer.slot === "decoration" || layer.slot === "texture") decorations += area(layer) * 0.2;
    else if (isText(layer)) secondary += area(layer);
  }

  const total = portrait + headline + secondary + decorations || 1;
  const texts = doc.layers.filter(isText).filter((l) => l.visible);
  const headlineLayer = texts.find((t) => t.slot === "headline");
  const nextLargest = Math.max(1, ...texts.filter((t) => t.slot !== "headline").map((t) => t.fontSize));
  const shortEdge = Math.min(doc.canvas.width, doc.canvas.height);
  const families = new Set(texts.map((t) => t.fontFamily));

  const inkCoverage = doc.layers
    .filter((l) => l.visible && l.slot !== "background" && l.slot !== "texture")
    .reduce((sum, l) => sum + area(l), 0);

  return {
    visualWeight: {
      portrait: round2(portrait / total),
      headline: round2(headline / total),
      secondaryText: round2(secondary / total),
      decorations: round2(decorations / total),
    },
    composition: doc.meta.composition || "unknown",
    headlineStyle: classifyHeadline(headlineLayer?.fontFamily ?? "", headlineLayer?.fontSize ?? 0, shortEdge),
    spacing: inkCoverage > 0.62 ? "tight" : inkCoverage < 0.34 ? "generous" : "balanced",
    energy: round2(clamp01(0.3 + (headlineLayer ? headlineLayer.fontSize / shortEdge : 0) * 4 + decorations * 2)),
    minimalism: round2(clamp01(1 - inkCoverage - texts.length * 0.03)),
    contrast: round2(clamp01((headlineLayer?.fontSize ?? 0) / Math.max(1, nextLargest) / 4)),
    scaleContrast: round2(Math.min(8, (headlineLayer?.fontSize ?? nextLargest) / nextLargest)),
    paletteTemperature: "neutral",
    fontFamilies: families.size,
    subjectCount: doc.layers.filter((l) => isImage(l) && (l.slot === "subject" || l.slot === "secondary-subject")).length,
  };
}

function classifyHeadline(family: string, size: number, shortEdge: number): DesignDna["headlineStyle"] {
  const big = size / Math.max(1, shortEdge) > 0.075;
  if (/Bebas|Anton|Oswald|Barlow Condensed|Big Shoulders/.test(family)) {
    return big ? "oversized_condensed" : "stacked_caps";
  }
  if (/Playfair|Cormorant|Instrument Serif/.test(family)) {
    return big ? "editorial_serif" : "mixed_case_elegant";
  }
  return big ? "oversized_display" : "modest_sans";
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Distance between two DNA objects, 0 (identical) → 1. Used for retrieval and dedupe. */
export function dnaDistance(a: DesignDna, b: DesignDna): number {
  const numeric: Array<[number, number, number]> = [
    [a.visualWeight.portrait, b.visualWeight.portrait, 1],
    [a.visualWeight.headline, b.visualWeight.headline, 1.2],
    [a.visualWeight.secondaryText, b.visualWeight.secondaryText, 0.6],
    [a.energy, b.energy, 1],
    [a.minimalism, b.minimalism, 1],
    [a.contrast, b.contrast, 0.8],
    [a.scaleContrast / 8, b.scaleContrast / 8, 0.8],
  ];
  const weightSum = numeric.reduce((s, [, , w]) => s + w, 0) + 2;
  const numericDistance = numeric.reduce((s, [x, y, w]) => s + Math.abs(x - y) * w, 0);
  const categorical =
    (a.composition === b.composition ? 0 : 1) + (a.headlineStyle === b.headlineStyle ? 0 : 1);
  return (numericDistance + categorical) / weightSum;
}

/** One-line description for LLM context — cheap tokens, high signal (§32). */
export function dnaToText(dna: DesignDna): string {
  return [
    `composition=${dna.composition}`,
    `headline=${dna.headlineStyle}`,
    `weights p:${dna.visualWeight.portrait} h:${dna.visualWeight.headline} t:${dna.visualWeight.secondaryText}`,
    `energy=${dna.energy}`,
    `minimalism=${dna.minimalism}`,
    `contrast=${dna.contrast}`,
    `scale=${dna.scaleContrast}x`,
    `spacing=${dna.spacing}`,
    `subjects=${dna.subjectCount}`,
  ].join(" ");
}
