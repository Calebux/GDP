import { z } from "zod";
import {
  Adjustments,
  BlendMode,
  HexColor,
  ImageTreatment,
  Paint,
  Shadow,
  SlotRole,
  Stroke,
  TextAlign,
  TextTransform,
  Unit,
  VerticalAlign,
} from "./primitives.js";

const BaseLayer = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  slot: SlotRole.default("custom"),
  x: Unit,
  y: Unit,
  width: z.number().min(0),
  height: z.number().min(0),
  rotation: z.number().min(-180).max(180).default(0),
  opacity: z.number().min(0).max(1).default(1),
  zIndex: z.number().int(),
  visible: z.boolean().default(true),
  /** Locked layers are protected from AI edits — brand assets use this (§64). */
  locked: z.boolean().default(false),
  blendMode: BlendMode.default("normal"),
  shadow: Shadow.optional(),
  /** Free-form notes from the planner explaining intent; used by semantic edits (§25). */
  intent: z.string().max(280).optional(),
});

/**
 * A single measured line of text. Line breaking happens once, server-side,
 * with the real font metrics, and is then baked into the document — the browser
 * editor and the export renderer can never disagree about where lines fall.
 */
export const TextLine = z.object({
  text: z.string(),
  width: z.number().min(0),
  /** Baseline offset from the text block's top edge. */
  baseline: z.number(),
});
export type TextLine = z.infer<typeof TextLine>;

export const TextLayer = BaseLayer.extend({
  type: z.literal("text"),
  content: z.string(),
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(950).default(400),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  fontSize: z.number().min(1).max(2000),
  lineHeight: z.number().min(0.6).max(3).default(1.1),
  /** Tracking in em units (0.02 = 2% of font size). */
  letterSpacing: z.number().min(-0.2).max(1).default(0),
  align: TextAlign.default("left"),
  verticalAlign: VerticalAlign.default("top"),
  transform: TextTransform.default("none"),
  color: HexColor,
  /** Optional decorative fill (gradient headline). Overrides `color` when set. */
  fill: Paint.optional(),
  stroke: Stroke.optional(),
  maxLines: z.number().int().min(1).max(20).default(4),
  /** How the typography engine reconciles content with the box (§17). */
  fit: z.enum(["shrink", "wrap", "fixed"]).default("shrink"),
  lines: z.array(TextLine).default([]),
  /** Set by the typography engine — true when content had to be clipped. */
  overflow: z.boolean().default(false),
});
export type TextLayer = z.infer<typeof TextLayer>;

export const Crop = z.object({
  x: z.number().min(0).max(1).default(0),
  y: z.number().min(0).max(1).default(0),
  width: z.number().min(0.01).max(1).default(1),
  height: z.number().min(0.01).max(1).default(1),
});
export type Crop = z.infer<typeof Crop>;

export const ImageLayer = BaseLayer.extend({
  type: z.literal("image"),
  assetId: z.string(),
  /** Cutout produced by the segmentation service; null keeps the full frame. */
  maskAssetId: z.string().nullable().default(null),
  crop: Crop.default({ x: 0, y: 0, width: 1, height: 1 }),
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  focalX: z.number().min(0).max(1).default(0.5),
  focalY: z.number().min(0).max(1).default(0.5),
  treatments: z.array(ImageTreatment).max(4).default([]),
  adjustments: Adjustments.default({ brightness: 0, contrast: 0, saturation: 0, exposure: 0 }),
  cornerRadius: z.number().min(0).default(0),
  /**
   * Asset integrity guard (§21, §33): when true the renderer refuses any
   * pixel-altering operation. Logos and faces are marked immutable.
   */
  immutable: z.boolean().default(false),
});
export type ImageLayer = z.infer<typeof ImageLayer>;

export const ShapeLayer = BaseLayer.extend({
  type: z.literal("shape"),
  shape: z.enum(["rect", "ellipse", "line", "triangle", "polygon", "path"]),
  fill: Paint.optional(),
  stroke: Stroke.optional(),
  cornerRadius: z.number().min(0).default(0),
  sides: z.number().int().min(3).max(12).default(6),
  /** Only for shape="path" — a whitelisted subset of SVG path commands. */
  path: z.string().max(20000).optional(),
});
export type ShapeLayer = z.infer<typeof ShapeLayer>;


/**
 * Procedural texture drawn by the renderer from a seed — never a generated
 * image, so it costs nothing and reproduces exactly (§34).
 */
export const TextureLayer = BaseLayer.extend({
  type: z.literal("texture"),
  texture: z.enum(["grain", "halftone", "mesh", "rays", "grid", "topography", "dots", "noise-gradient"]),
  color: HexColor,
  baseColor: HexColor.optional(),
  intensity: z.number().min(0).max(1).default(0.3),
  scale: z.number().min(0.1).max(20).default(1),
  seed: z.number().int().min(0).max(99999).default(1),
});
export type TextureLayer = z.infer<typeof TextureLayer>;

export const GroupLayer = BaseLayer.extend({
  type: z.literal("group"),
  children: z.array(z.string()).default([]),
});
export type GroupLayer = z.infer<typeof GroupLayer>;

export const Layer = z.discriminatedUnion("type", [TextLayer, ImageLayer, ShapeLayer, TextureLayer, GroupLayer]);
export type Layer = z.infer<typeof Layer>;
export type LayerType = Layer["type"];

export const isText = (l: Layer): l is TextLayer => l.type === "text";
export const isImage = (l: Layer): l is ImageLayer => l.type === "image";
export const isShape = (l: Layer): l is ShapeLayer => l.type === "shape";
export const isTexture = (l: Layer): l is TextureLayer => l.type === "texture";
export const isGroup = (l: Layer): l is GroupLayer => l.type === "group";
