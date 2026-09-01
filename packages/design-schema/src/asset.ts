import { z } from "zod";

export const AssetKind = z.enum(["portrait", "photo", "logo", "qr", "texture", "mask", "render"]);
export type AssetKind = z.infer<typeof AssetKind>;

export const BoundingBox = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBox>;

/** §8 — everything the design planner needs to reason about an upload. */
export const AssetAnalysis = z.object({
  orientation: z.enum(["portrait", "landscape", "square"]),
  hasAlpha: z.boolean().default(false),
  /** Subject bounds in normalised coordinates (0–1). */
  subjectBox: BoundingBox.optional(),
  headBox: BoundingBox.optional(),
  eyeLevel: z.number().min(0).max(1).optional(),
  /** Which way the person is looking — drives which side they are placed on. */
  facing: z.enum(["left", "right", "front", "unknown"]).default("unknown"),
  faceCount: z.number().int().min(0).default(0),
  dominantColors: z.array(z.string()).max(8).default([]),
  clothingColors: z.array(z.string()).max(4).default([]),
  /** 0–1; low values trigger a resolution warning in QA (§21). */
  sharpness: z.number().min(0).max(1).default(0.5),
  brightness: z.number().min(0).max(1).default(0.5),
  /** Largest empty regions, normalised — where text can safely live. */
  negativeSpace: z.array(BoundingBox).max(4).default([]),
  notes: z.string().default(""),
});
export type AssetAnalysis = z.infer<typeof AssetAnalysis>;

export const Asset = z.object({
  id: z.string(),
  kind: AssetKind,
  /** Storage key, resolved to a URL by @gdp/storage. */
  key: z.string(),
  mimeType: z.string(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  bytes: z.number().int().min(0).default(0),
  /** Cutout produced by background removal (§7). */
  maskKey: z.string().nullable().default(null),
  cutoutKey: z.string().nullable().default(null),
  analysis: AssetAnalysis.optional(),
  /** Slot hint from the upload step: "portrait_1", "logo_1", ... */
  ref: z.string().default(""),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Asset = z.infer<typeof Asset>;
