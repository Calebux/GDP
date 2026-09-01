import { z } from "zod";
import { HexColor, ImageTreatment, SlotRole } from "./primitives.js";

/**
 * Composition archetypes (§10). The planner picks one by name; the layout
 * engine owns the geometry. This is the line that keeps the LLM out of pixel
 * space — it decides *intent*, the engine decides *coordinates*.
 */
export const COMPOSITION_ARCHETYPES = [
  "portrait-right-headline-left",
  "portrait-left-headline-right",
  "portrait-center-headline-above",
  "portrait-center-headline-behind",
  "headline-dominant-portrait-small",
  "full-bleed-image-bottom-stack",
  "split-diagonal",
  "editorial-grid",
  "stacked-center-minimal",
  "two-person-split",
  "three-speaker-row",
  "typographic-poster",
  "offer-block-center",
  "banded-poster",
] as const;

export type CompositionArchetype = (typeof COMPOSITION_ARCHETYPES)[number];
export const CompositionArchetype = z.enum(COMPOSITION_ARCHETYPES);

export const BackgroundPlan = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: HexColor }),
  z.object({
    type: z.literal("gradient"),
    from: HexColor,
    to: HexColor,
    angle: z.number().min(0).max(360).default(135),
  }),
  z.object({
    type: z.literal("photo"),
    assetRef: z.string(),
    darken: z.number().min(0).max(1).default(0.45),
    blur: z.number().min(0).max(60).default(0),
  }),
  z.object({
    type: z.literal("texture"),
    /** Deterministic procedural texture drawn by the renderer, not a model. */
    texture: z.enum(["grain", "halftone", "mesh", "rays", "grid", "topography"]),
    color: HexColor,
    baseColor: HexColor,
    intensity: z.number().min(0).max(1).default(0.3),
  }),
]);
export type BackgroundPlan = z.infer<typeof BackgroundPlan>;

export const SlotPlan = z.object({
  role: SlotRole,
  /** Literal user copy for text slots. Never invented by the model (§33). */
  text: z.string().max(400).optional(),
  /** Reference to an uploaded asset, e.g. "portrait_1", "logo_1". */
  assetRef: z.string().optional(),
  /** Relative visual weight, 0–1. Drives scale within the archetype (§13). */
  emphasis: z.number().min(0).max(1).default(0.5),
  /** Which type style in the plan's typography block applies. */
  styleKey: z.string().default("body"),
  treatment: ImageTreatment.optional(),
  colorRole: z.enum(["ink", "inkMuted", "accent", "accentAlt", "surface", "background"]).default("ink"),
  notes: z.string().max(200).optional(),
});
export type SlotPlan = z.infer<typeof SlotPlan>;

export const TypographyPlan = z.object({
  headlineFont: z.string(),
  supportFont: z.string(),
  /** Optional third family; the engine rejects a fourth (§17). */
  accentFont: z.string().optional(),
  headlineCase: z.enum(["none", "uppercase", "capitalize"]).default("uppercase"),
  headlineTracking: z.number().min(-0.08).max(0.3).default(-0.02),
  headlineAlign: z.enum(["left", "center", "right"]).default("left"),
  /** Ratio of headline size to the next level down. 1.6–4 reads as hierarchy. */
  scaleContrast: z.number().min(1.2).max(6).default(2.6),
  density: z.enum(["airy", "balanced", "dense"]).default("balanced"),
});
export type TypographyPlan = z.infer<typeof TypographyPlan>;

export const PalettePlan = z.object({
  name: z.string().default(""),
  background: HexColor,
  surface: HexColor,
  ink: HexColor,
  inkMuted: HexColor,
  accent: HexColor,
  accentAlt: HexColor.optional(),
});
export type PalettePlan = z.infer<typeof PalettePlan>;

export const DecorationPlan = z.object({
  kind: z.enum([
    "accent-bar",
    "corner-brackets",
    "circle-badge",
    "diagonal-slash",
    "grid-lines",
    "outline-text-echo",
    "dotted-field",
    "arc",
    "none",
  ]),
  colorRole: z.enum(["accent", "accentAlt", "ink", "inkMuted", "surface"]).default("accent"),
  intensity: z.number().min(0).max(1).default(0.4),
});
export type DecorationPlan = z.infer<typeof DecorationPlan>;

/** Design DNA the planner asserts for this concept (§13). */
export const DnaPlan = z.object({
  energy: z.number().min(0).max(1).default(0.5),
  minimalism: z.number().min(0).max(1).default(0.5),
  contrast: z.number().min(0).max(1).default(0.7),
  spacing: z.enum(["tight", "balanced", "generous"]).default("balanced"),
});
export type DnaPlan = z.infer<typeof DnaPlan>;

/**
 * A single design concept, as returned by the planner LLM.
 * This is the ONLY shape the model is allowed to produce (§63, §64).
 */
export const DesignConceptPlan = z.object({
  conceptName: z.string().max(60),
  rationale: z.string().max(600),
  archetype: CompositionArchetype,
  background: BackgroundPlan,
  palette: PalettePlan,
  typography: TypographyPlan,
  dna: DnaPlan,
  slots: z.array(SlotPlan).min(1).max(20),
  decorations: z.array(DecorationPlan).max(3).default([]),
  subjectTreatment: z.array(ImageTreatment).max(3).default([]),
});
export type DesignConceptPlan = z.infer<typeof DesignConceptPlan>;

export const DesignPlan = z.object({
  concepts: z.array(DesignConceptPlan).min(1).max(10),
});
export type DesignPlan = z.infer<typeof DesignPlan>;
