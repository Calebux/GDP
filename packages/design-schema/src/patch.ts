import { z } from "zod";
import { HexColor, ImageTreatment, Paint, SlotRole } from "./primitives.js";
import { CompositionArchetype } from "./plan.js";

/**
 * §56 — natural-language edits become JSON patches, never a re-generation.
 * The op vocabulary is deliberately small: anything the AI cannot express here
 * it cannot do at all.
 */

const TargetById = z.object({ layerId: z.string() });
const TargetBySlot = z.object({ slot: SlotRole });
const Target = z.union([TargetById, TargetBySlot]);
export type PatchTarget = z.infer<typeof Target>;

export const SetTextOp = z.object({
  op: z.literal("set-text"),
  target: Target,
  content: z.string().max(400),
});

export const StyleTextOp = z.object({
  op: z.literal("style-text"),
  target: Target,
  fontFamily: z.string().optional(),
  fontWeight: z.number().int().min(100).max(950).optional(),
  /** Multiplier on the current size — relative keeps hierarchy intact. */
  sizeScale: z.number().min(0.3).max(3).optional(),
  lineHeight: z.number().min(0.6).max(3).optional(),
  letterSpacing: z.number().min(-0.2).max(1).optional(),
  align: z.enum(["left", "center", "right", "justify"]).optional(),
  transform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  color: HexColor.optional(),
});

export const MoveOp = z.object({
  op: z.literal("move"),
  target: Target,
  /** Fraction of canvas width/height. Relative moves survive resizes. */
  dx: z.number().min(-1).max(1).default(0),
  dy: z.number().min(-1).max(1).default(0),
});

export const PlaceOp = z.object({
  op: z.literal("place"),
  target: Target,
  /** Named position, resolved by the layout engine against the grid. */
  position: z.enum([
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ]),
});

export const ScaleOp = z.object({
  op: z.literal("scale"),
  target: Target,
  factor: z.number().min(0.2).max(4),
});

export const SetPaletteOp = z.object({
  op: z.literal("set-palette"),
  background: HexColor.optional(),
  surface: HexColor.optional(),
  ink: HexColor.optional(),
  inkMuted: HexColor.optional(),
  accent: HexColor.optional(),
  accentAlt: HexColor.optional(),
  name: z.string().max(60).optional(),
});

export const SetBackgroundOp = z.object({
  op: z.literal("set-background"),
  paint: Paint,
});

export const SetTreatmentOp = z.object({
  op: z.literal("set-treatment"),
  target: Target,
  treatments: z.array(ImageTreatment).max(4),
});

export const ReorderOp = z.object({
  op: z.literal("reorder"),
  target: Target,
  to: z.enum(["front", "back", "forward", "backward"]),
});

export const SetVisibilityOp = z.object({
  op: z.literal("set-visibility"),
  target: Target,
  visible: z.boolean(),
});

export const DeleteOp = z.object({
  op: z.literal("delete"),
  target: Target,
});

export const AddDecorationOp = z.object({
  op: z.literal("add-decoration"),
  kind: z.enum([
    "accent-bar",
    "corner-brackets",
    "circle-badge",
    "diagonal-slash",
    "grid-lines",
    "dotted-field",
    "arc",
  ]),
  colorRole: z.enum(["accent", "accentAlt", "ink", "inkMuted", "surface"]).default("accent"),
  intensity: z.number().min(0).max(1).default(0.4),
});

/** Structural change — re-runs the layout engine rather than nudging pixels. */
export const RecomposeOp = z.object({
  op: z.literal("recompose"),
  archetype: CompositionArchetype.optional(),
  spacing: z.enum(["tight", "balanced", "generous"]).optional(),
  scaleContrast: z.number().min(1.2).max(6).optional(),
  density: z.enum(["airy", "balanced", "dense"]).optional(),
});

export const DesignPatchOp = z.discriminatedUnion("op", [
  SetTextOp,
  StyleTextOp,
  MoveOp,
  PlaceOp,
  ScaleOp,
  SetPaletteOp,
  SetBackgroundOp,
  SetTreatmentOp,
  ReorderOp,
  SetVisibilityOp,
  DeleteOp,
  AddDecorationOp,
  RecomposeOp,
]);
export type DesignPatchOp = z.infer<typeof DesignPatchOp>;

export const DesignPatch = z.object({
  /** One-line summary shown in version history (§26). */
  summary: z.string().max(120),
  ops: z.array(DesignPatchOp).min(1).max(12),
});
export type DesignPatch = z.infer<typeof DesignPatch>;
