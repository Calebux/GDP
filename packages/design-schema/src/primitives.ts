import { z } from "zod";

/** Hex colour, 3/6/8 digits. The renderer never accepts named CSS colours. */
export const HexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "must be a hex colour");
export type HexColor = z.infer<typeof HexColor>;

export const Unit = z.number().finite();

export const GradientStop = z.object({
  offset: z.number().min(0).max(1),
  color: HexColor,
  opacity: z.number().min(0).max(1).default(1),
});
export type GradientStop = z.infer<typeof GradientStop>;

export const SolidPaint = z.object({
  type: z.literal("solid"),
  color: HexColor,
  opacity: z.number().min(0).max(1).default(1),
});

export const LinearGradientPaint = z.object({
  type: z.literal("linear-gradient"),
  /** Degrees, 0 = left→right, 90 = top→bottom. */
  angle: z.number().min(0).max(360).default(135),
  stops: z.array(GradientStop).min(2).max(6),
});

export const RadialGradientPaint = z.object({
  type: z.literal("radial-gradient"),
  /** Focus point in normalised canvas space. */
  cx: z.number().min(-0.5).max(1.5).default(0.5),
  cy: z.number().min(-0.5).max(1.5).default(0.5),
  radius: z.number().min(0.05).max(2).default(0.75),
  stops: z.array(GradientStop).min(2).max(6),
});

export const ImagePaint = z.object({
  type: z.literal("image"),
  assetId: z.string(),
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  /** Normalised focal point used when cropping. */
  focalX: z.number().min(0).max(1).default(0.5),
  focalY: z.number().min(0).max(1).default(0.5),
  opacity: z.number().min(0).max(1).default(1),
});

export const Paint = z.discriminatedUnion("type", [
  SolidPaint,
  LinearGradientPaint,
  RadialGradientPaint,
  ImagePaint,
]);
export type Paint = z.infer<typeof Paint>;

export const Stroke = z.object({
  color: HexColor,
  width: z.number().min(0).max(200),
  align: z.enum(["inside", "center", "outside"]).default("center"),
  dash: z.array(z.number().min(0)).max(6).optional(),
});
export type Stroke = z.infer<typeof Stroke>;

export const Shadow = z.object({
  type: z.enum(["drop", "inner"]).default("drop"),
  x: Unit.default(0),
  y: Unit.default(12),
  blur: z.number().min(0).max(400).default(24),
  spread: z.number().min(-100).max(100).default(0),
  color: HexColor.default("#00000059"),
});
export type Shadow = z.infer<typeof Shadow>;

export const BlendMode = z.enum([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);
export type BlendMode = z.infer<typeof BlendMode>;

/**
 * Photographic treatments (§10 "Image Treatment"). These are deterministic
 * filter pipelines applied by the renderer — never a generative pass, so the
 * subject's identity is preserved bit-for-bit under the mask (§1.2).
 */
export const ImageTreatment = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("duotone"),
    shadow: HexColor,
    highlight: HexColor,
    strength: z.number().min(0).max(1).default(1),
  }),
  z.object({ type: z.literal("monochrome"), strength: z.number().min(0).max(1).default(1) }),
  z.object({
    type: z.literal("gradient-map"),
    stops: z.array(GradientStop).min(2).max(4),
    strength: z.number().min(0).max(1).default(0.85),
  }),
  z.object({
    type: z.literal("rim-light"),
    color: HexColor,
    intensity: z.number().min(0).max(1).default(0.6),
    angle: z.number().min(0).max(360).default(225),
  }),
  z.object({ type: z.literal("grain"), amount: z.number().min(0).max(1).default(0.15) }),
  z.object({ type: z.literal("blur"), radius: z.number().min(0).max(200).default(12) }),
  z.object({
    type: z.literal("halftone"),
    dotSize: z.number().min(1).max(40).default(6),
    color: HexColor.default("#000000"),
  }),
]);
export type ImageTreatment = z.infer<typeof ImageTreatment>;

export const Adjustments = z.object({
  brightness: z.number().min(-1).max(1).default(0),
  contrast: z.number().min(-1).max(1).default(0),
  saturation: z.number().min(-1).max(1).default(0),
  exposure: z.number().min(-1).max(1).default(0),
});
export type Adjustments = z.infer<typeof Adjustments>;

export const TextAlign = z.enum(["left", "center", "right", "justify"]);
export const VerticalAlign = z.enum(["top", "middle", "bottom"]);
export const TextTransform = z.enum(["none", "uppercase", "lowercase", "capitalize"]);

/**
 * Semantic slot names. Every layer carries one so the AI, the QA engine and
 * the resize engine can reason about *meaning* rather than coordinates (§25, §28).
 */
export const SlotRole = z.enum([
  "background",
  "texture",
  "backdrop-shape",
  "subject",
  "subject-shadow",
  "secondary-subject",
  "eyebrow",
  "headline",
  /** The promotion itself — "20% OFF", "BOGO", "$15 CUTS". Outranks the occasion. */
  "offer",
  "offer-detail",
  "promo-code",
  "subheadline",
  "body",
  "date",
  "time",
  "location",
  "cta",
  "logo",
  "secondary-logo",
  "sponsor",
  "qr",
  "footer",
  "decoration",
  "divider",
  "overlay",
  "custom",
]);
export type SlotRole = z.infer<typeof SlotRole>;

/** Text roles participate in the typographic hierarchy (§17). */
export const TEXT_SLOTS: SlotRole[] = [
  "eyebrow",
  "headline",
  "offer",
  "offer-detail",
  "promo-code",
  "subheadline",
  "body",
  "date",
  "time",
  "location",
  "cta",
  "footer",
];
