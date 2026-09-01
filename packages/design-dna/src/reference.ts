import { z } from "zod";
import { CompositionArchetype } from "@gdp/design-schema";
import { DesignDna } from "./dna.js";

/**
 * §10 / §36 — reference metadata. A reference teaches principles; the platform
 * never reproduces one pixel-for-pixel (§11).
 */
export const ReferenceDesign = z.object({
  id: z.string(),
  title: z.string().default(""),
  category: z.string(),
  subcategory: z.string().default(""),
  /** Where it came from, for licence hygiene and attribution. */
  sourceUrl: z.string().default(""),
  sourceCredit: z.string().default(""),
  imageKey: z.string().default(""),
  thumbnailKey: z.string().default(""),

  composition: CompositionArchetype,
  characteristics: z.array(z.string()).max(12).default([]),

  typography: z.object({
    families: z.number().int().min(1).max(6),
    classification: z.enum(["sans", "serif", "display", "mixed", "script"]),
    headlineAlign: z.enum(["left", "center", "right"]),
    headlineWidthRatio: z.number().min(0).max(1),
    scaleContrast: z.number().min(1).max(8),
    tracking: z.number().min(-0.1).max(0.4),
    lineSpacing: z.number().min(0.7).max(2.5),
  }),

  palette: z.object({
    dominant: z.array(z.string()).max(6),
    accents: z.array(z.string()).max(3),
    contrast: z.enum(["low", "medium", "high"]),
    scheme: z.enum(["monochromatic", "duotone", "polychromatic"]),
    temperature: z.enum(["warm", "cool", "neutral"]),
  }),

  imageTreatment: z.array(z.string()).max(6).default([]),

  geometry: z.object({
    subjectBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
    headlineBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
    logoArea: z.enum(["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right", "none"]).default("top-left"),
    whitespaceRatio: z.number().min(0).max(1).default(0.4),
  }),

  dna: DesignDna,

  /** §10 — only strong work enters retrieval. */
  qualityScore: z.number().int().min(1).max(100),
  reviewedBy: z.string().default(""),
  approved: z.boolean().default(false),
  styleDirections: z.array(z.string()).max(4).default([]),
  notes: z.string().default(""),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type ReferenceDesign = z.infer<typeof ReferenceDesign>;

/**
 * The text sent to the planner for each retrieved reference — principles only,
 * never "copy this design" (§11).
 */
export function referenceDigest(reference: ReferenceDesign): string {
  return [
    `${reference.composition}`,
    reference.characteristics.slice(0, 5).join(", "),
    `type: ${reference.typography.classification}, ${reference.typography.families} families, ${reference.typography.scaleContrast}× scale contrast, ${reference.typography.headlineAlign}-aligned`,
    `palette: ${reference.palette.scheme}/${reference.palette.temperature}, ${reference.palette.contrast} contrast, accents ${reference.palette.accents.join(" ")}`,
    reference.imageTreatment.length > 0 ? `treatment: ${reference.imageTreatment.join(", ")}` : "",
    `whitespace ${Math.round(reference.geometry.whitespaceRatio * 100)}%`,
  ]
    .filter(Boolean)
    .join(" | ");
}

/** The retrieval query built from a brief (§12). */
export function buildRetrievalQuery(input: {
  category: string;
  subcategory: string;
  direction: string;
  audience?: string;
  people?: number;
  feeling?: string;
}): string {
  return [
    input.category,
    input.subcategory,
    input.direction,
    input.people === 1 ? "single subject portrait" : input.people && input.people > 1 ? `${input.people} speakers` : "typographic",
    input.audience ?? "",
    input.feeling ?? "",
  ]
    .filter((part) => part && part.length > 0)
    .join(", ");
}
