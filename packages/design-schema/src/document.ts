import { z } from "zod";
import { HexColor, Paint, SlotRole } from "./primitives.js";
import { Layer } from "./layers.js";

/** Output formats (§28). Every format knows its own safe areas. */
export const FORMATS = {
  "ig-portrait": { width: 1080, height: 1350, label: "Instagram portrait" },
  "ig-square": { width: 1080, height: 1080, label: "Instagram square" },
  story: { width: 1080, height: 1920, label: "Story / WhatsApp status" },
  "x-post": { width: 1600, height: 900, label: "X post" },
  facebook: { width: 1200, height: 630, label: "Facebook" },
  "youtube-thumb": { width: 1280, height: 720, label: "YouTube thumbnail" },
  "flyer-a5": { width: 1748, height: 2480, label: "A5 flyer (300dpi)" },
  "flyer-a4": { width: 2480, height: 3508, label: "A4 flyer (300dpi)" },
} as const;

export type FormatId = keyof typeof FORMATS;
export const FormatId = z.enum(Object.keys(FORMATS) as [FormatId, ...FormatId[]]);

export const SafeArea = z.object({
  top: z.number().min(0).default(0),
  right: z.number().min(0).default(0),
  bottom: z.number().min(0).default(0),
  left: z.number().min(0).default(0),
});
export type SafeArea = z.infer<typeof SafeArea>;

export const Canvas = z.object({
  width: z.number().int().min(64).max(8000),
  height: z.number().int().min(64).max(8000),
  format: FormatId.default("ig-portrait"),
  dpi: z.number().int().min(72).max(600).default(72),
  /** Margin the design must respect (§17 "minimum spacing from boundaries"). */
  margin: z.number().min(0).default(72),
  /** Platform chrome overlaps — text must stay clear of these (§21). */
  safeArea: SafeArea.default({ top: 0, right: 0, bottom: 0, left: 0 }),
  /** Print bleed, in px at the canvas dpi. */
  bleed: z.number().min(0).default(0),
  background: Paint.default({ type: "solid", color: "#0b0b0f", opacity: 1 }),
  /** Columns used by the layout engine to align everything to a common grid. */
  columns: z.number().int().min(1).max(24).default(12),
  gutter: z.number().min(0).default(24),
  baselineUnit: z.number().min(1).default(8),
});
export type Canvas = z.infer<typeof Canvas>;

/**
 * Named palette roles. Layers reference colours literally (so the renderer stays
 * dumb) but the palette lets AI edits like "make it feel more premium" recolour
 * an entire design coherently.
 */
export const Palette = z.object({
  background: HexColor,
  surface: HexColor,
  ink: HexColor,
  inkMuted: HexColor,
  accent: HexColor,
  accentAlt: HexColor.optional(),
  name: z.string().default(""),
});
export type Palette = z.infer<typeof Palette>;

export const TypeStyle = z.object({
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(950),
  /** Size relative to the canvas short edge, so resizes recompose (§28). */
  sizeRatio: z.number().min(0.005).max(0.5),
  lineHeight: z.number().min(0.6).max(3),
  letterSpacing: z.number().min(-0.2).max(1),
  transform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).default("none"),
});
export type TypeStyle = z.infer<typeof TypeStyle>;

export const TypeScale = z.record(z.string(), TypeStyle);
export type TypeScale = z.infer<typeof TypeScale>;

export const DesignMeta = z.object({
  title: z.string().default("Untitled design"),
  category: z.string().default("church"),
  subcategory: z.string().default(""),
  styleDirection: z.string().default(""),
  /** Composition archetype the layout engine used (§10 "Composition"). */
  composition: z.string().default(""),
  /** Reference ids that informed this design — provenance for §11 auditing. */
  referenceIds: z.array(z.string()).default([]),
  plannerModel: z.string().default(""),
  createdAt: z.string().default(() => new Date().toISOString()),
  notes: z.string().default(""),
});
export type DesignMeta = z.infer<typeof DesignMeta>;

/**
 * THE central artefact (§62). A design is a document, never an image.
 * An image is one possible export of this document.
 */
export const DesignDocument = z.object({
  schemaVersion: z.literal("1.0"),
  id: z.string(),
  canvas: Canvas,
  palette: Palette,
  typeScale: TypeScale.default({}),
  layers: z.array(Layer).max(200),
  meta: DesignMeta.prefault({}),
  /** Ids of assets the document references, for integrity checks. */
  assetIds: z.array(z.string()).default([]),
});
export type DesignDocument = z.infer<typeof DesignDocument>;

// ---------- helpers ----------

export function sortedLayers(doc: DesignDocument): Layer[] {
  return [...doc.layers].sort((a, b) => a.zIndex - b.zIndex);
}

export function findLayer(doc: DesignDocument, id: string): Layer | undefined {
  return doc.layers.find((l) => l.id === id);
}

export function findBySlot(doc: DesignDocument, slot: SlotRole): Layer[] {
  return doc.layers.filter((l) => l.slot === slot);
}

export function contentBox(canvas: Canvas): { x: number; y: number; width: number; height: number } {
  const m = canvas.margin;
  return {
    x: m + canvas.safeArea.left,
    y: m + canvas.safeArea.top,
    width: canvas.width - m * 2 - canvas.safeArea.left - canvas.safeArea.right,
    height: canvas.height - m * 2 - canvas.safeArea.top - canvas.safeArea.bottom,
  };
}

export function columnWidth(canvas: Canvas): number {
  const box = contentBox(canvas);
  return (box.width - canvas.gutter * (canvas.columns - 1)) / canvas.columns;
}

/** Snap a value to the baseline grid — deliberate spacing, not arbitrary numbers. */
export function snap(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

export function cloneDocument(doc: DesignDocument): DesignDocument {
  return structuredClone(doc);
}

export function nextZIndex(doc: DesignDocument): number {
  return doc.layers.reduce((max, l) => Math.max(max, l.zIndex), 0) + 1;
}
