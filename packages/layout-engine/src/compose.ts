import { bestContrast, contrastRatio, px, type Rect } from "@gdp/core";
import {
  type AssetAnalysis,
  type AssetKind,
  type Canvas,
  type DesignConceptPlan,
  type DesignDocument,
  type DesignMeta,
  type Layer,
  type Palette,
  type SlotRole,
  type TextLayer,
  type TypeScale,
  enforceGuards,
} from "@gdp/design-schema";
import { fallbackFor, isAvailable } from "@gdp/fonts";
import { buildTypeScale, layoutText, longestWordWidth, minimumFontSize, sizeFor } from "@gdp/typography";
import { orientArchetype, regionsFor, type Regions } from "./archetypes.js";
import { buildBackground } from "./background.js";
import { buildDecorations } from "./decorations.js";

export interface AssetRefInfo {
  id: string;
  ref: string;
  kind: AssetKind;
  width: number;
  height: number;
  /** Cutout produced by §7; when present the subject is drawn masked. */
  cutout?: boolean;
  analysis?: AssetAnalysis;
}

export interface ComposeInput {
  id: string;
  canvas: Canvas;
  plan: DesignConceptPlan;
  assets: AssetRefInfo[];
  meta?: Partial<DesignMeta>;
}

export interface ComposeResult {
  doc: DesignDocument;
  repairs: { layerId: string | null; rule: string; message: string; severity: "info" | "warn" }[];
}

/** Vertical order of the text hierarchy inside the stack. */
const STACK_ORDER: SlotRole[] = ["eyebrow", "headline", "subheadline", "body"];
const DETAIL_ROLES: SlotRole[] = ["date", "time", "location"];

const MAX_LINES: Partial<Record<SlotRole, number>> = {
  eyebrow: 1,
  headline: 3,
  subheadline: 2,
  body: 4,
  date: 1,
  time: 1,
  location: 2,
  cta: 1,
  footer: 2,
};

const GAP_UNITS: Partial<Record<SlotRole, number>> = {
  eyebrow: 0,
  headline: 1.6,
  subheadline: 1.4,
  body: 2,
  details: 3,
  cta: 2.6,
} as Partial<Record<SlotRole, number>> & { details: number };

const SPACING_MULTIPLIER = { tight: 0.7, balanced: 1, generous: 1.5 } as const;

interface Block {
  role: SlotRole;
  text: string;
  layer: TextLayer;
  gapBefore: number;
  inline: boolean;
}

export function composeDocument(input: ComposeInput): ComposeResult {
  const { plan, canvas } = input;
  const byRef = new Map(input.assets.map((a) => [a.ref, a]));
  const assetIdFor = (ref: string): string | undefined => byRef.get(ref)?.id;

  const subjectSlots = plan.slots.filter(
    (s) => (s.role === "subject" || s.role === "secondary-subject") && s.assetRef,
  );
  const primarySubject = subjectSlots[0] ? byRef.get(subjectSlots[0].assetRef!) : undefined;
  const facing = primarySubject?.analysis?.facing ?? "unknown";

  const archetype = orientArchetype(plan.archetype, facing);
  const regions = regionsFor(archetype, canvas, {
    subjectFacing: facing,
    subjectCount: subjectSlots.length,
    spacing: plan.dna.spacing,
  });

  const palette: Palette = {
    background: plan.palette.background,
    surface: plan.palette.surface,
    ink: plan.palette.ink,
    inkMuted: plan.palette.inkMuted,
    accent: plan.palette.accent,
    ...(plan.palette.accentAlt ? { accentAlt: plan.palette.accentAlt } : {}),
    name: plan.palette.name,
  };

  const typography = {
    ...plan.typography,
    headlineFont: isAvailable(plan.typography.headlineFont)
      ? plan.typography.headlineFont
      : fallbackFor(plan.typography.headlineFont),
    supportFont: isAvailable(plan.typography.supportFont)
      ? plan.typography.supportFont
      : fallbackFor(plan.typography.supportFont),
  };
  const typeScale = buildTypeScale(typography, canvas);

  const background = buildBackground(plan.background, canvas, assetIdFor);
  const layers: Layer[] = [...background.layers];

  // ---- subjects ----
  const subjectZ = regions.headlineBehindSubject ? 12 : 6;
  const subjectRects: Rect[] = [];
  subjectSlots.forEach((slot, index) => {
    const asset = slot.assetRef ? byRef.get(slot.assetRef) : undefined;
    const region = regions.subjects[index];
    if (!asset || !region) return;
    const layer = buildSubjectLayer({
      asset,
      region,
      index,
      zIndex: subjectZ + index,
      fullBleed: regions.fullBleedImage,
      anchor: regions.subjectAnchor,
      treatments: plan.subjectTreatment,
    });
    layers.push(layer);
    subjectRects.push({ x: layer.x, y: layer.y, width: layer.width, height: layer.height });
  });

  // Text must not run into the person, and the headline must not be crushed to
  // fit. Negotiate: give the column the width its longest word needs, sliding
  // and shrinking the subject within a designer-acceptable range first.
  let composedRegions: Regions = regions;
  if (!regions.headlineBehindSubject && !regions.fullBleedImage && subjectRects.length > 0) {
    const required = requiredHeadlineWidth(plan, typeScale, canvas, regions.headlineDominance);
    const shift = negotiateSubjects(regions, subjectRects, canvas.gutter, required, canvas.width);
    if (shift.applied) {
      for (const layer of layers) {
        if (layer.slot !== "subject" && layer.slot !== "secondary-subject") continue;
        const rect = shift.rects.get(layer.id);
        if (!rect) continue;
        layer.x = px(rect.x);
        layer.y = px(rect.y);
        layer.width = px(rect.width);
        layer.height = px(rect.height);
      }
    }
    composedRegions = {
      ...regions,
      textStack: constrainStack(regions, [...shift.rects.values()], canvas.gutter),
    };
  }

  // ---- overlay for full-bleed compositions ----
  if (regions.overlay === "bottom-gradient") {
    layers.push({
      type: "shape",
      id: "overlay_gradient",
      name: "Legibility gradient",
      slot: "overlay",
      x: 0,
      y: canvas.height * 0.34,
      width: canvas.width,
      height: canvas.height * 0.66,
      rotation: 0,
      opacity: 1,
      zIndex: 9,
      visible: true,
      locked: false,
      blendMode: "normal",
      shape: "rect",
      fill: {
        type: "linear-gradient",
        angle: 90,
        stops: [
          { offset: 0, color: palette.background, opacity: 0 },
          { offset: 0.55, color: palette.background, opacity: 0.78 },
          { offset: 1, color: palette.background, opacity: 0.96 },
        ],
      },
      cornerRadius: 0,
      sides: 6,
    });
  }

  // ---- text stack ----
  const stackLayers = buildTextStack({
    plan,
    canvas,
    typeScale,
    regions: composedRegions,
    palette,
    effectiveBackground: background.effectiveColor,
    headlineBehind: regions.headlineBehindSubject,
  });
  layers.push(...stackLayers);

  // ---- logo ----
  const logoSlot = plan.slots.find((s) => s.role === "logo" && s.assetRef);
  const logoAsset = logoSlot?.assetRef ? byRef.get(logoSlot.assetRef) : undefined;
  if (logoAsset) {
    layers.push(buildLogoLayer(logoAsset, composedRegions, 22));
  }

  // ---- footer ----
  const footerSlot = plan.slots.find((s) => s.role === "footer" && s.text);
  if (footerSlot?.text) {
    const style = typeScale.footer;
    if (style) {
      const size = Math.max(minimumFontSize(canvas), sizeFor(style, canvas));
      const layout = layoutText({
        content: footerSlot.text,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: size,
        minFontSize: minimumFontSize(canvas),
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        maxWidth: composedRegions.footer.width,
        maxLines: MAX_LINES.footer ?? 2,
        transform: style.transform,
        fit: "shrink",
      });
      layers.push(
        textLayer({
          id: "footer",
          slot: "footer",
          rect: {
            x: composedRegions.footer.x,
            y: composedRegions.footer.y,
            width: composedRegions.footer.width,
            height: layout.height,
          },
          content: footerSlot.text,
          style,
          size: layout.fontSize,
          align: composedRegions.textAlign === "right" ? "right" : composedRegions.textAlign,
          color: palette.inkMuted,
          layout,
          zIndex: 24,
        }),
      );
    }
  }

  // ---- decorations ----
  const headlineLayer = stackLayers.find((l) => l.slot === "headline");
  const anchor: Rect = headlineLayer
    ? { x: headlineLayer.x, y: headlineLayer.y, width: headlineLayer.width, height: headlineLayer.height }
    : composedRegions.textStack;
  layers.push(
    ...buildDecorations(plan.decorations, canvas, palette, {
      textStack: anchor,
      footer: composedRegions.footer,
      align: composedRegions.textAlign,
    }, 26),
  );

  const doc: DesignDocument = {
    schemaVersion: "1.0",
    id: input.id,
    canvas: { ...canvas, background: background.paint },
    palette,
    typeScale,
    layers,
    assetIds: input.assets.map((a) => a.id),
    meta: {
      title: input.meta?.title ?? plan.conceptName,
      category: input.meta?.category ?? "church",
      subcategory: input.meta?.subcategory ?? "",
      styleDirection: input.meta?.styleDirection ?? "",
      composition: archetype,
      referenceIds: input.meta?.referenceIds ?? [],
      plannerModel: input.meta?.plannerModel ?? "",
      createdAt: input.meta?.createdAt ?? new Date().toISOString(),
      notes: input.meta?.notes ?? plan.rationale,
    },
  };

  const { doc: guarded, repairs } = enforceGuards(doc, {
    fontAvailable: isAvailable,
    fontFallback: fallbackFor,
    minFontSize: minimumFontSize(canvas),
    maxFontFamilies: 3,
    bleedSlots: [
      "background",
      "texture",
      "overlay",
      "backdrop-shape",
      "decoration",
      "subject",
      "secondary-subject",
    ],
  });

  return { doc: guarded, repairs };
}

/**
 * The width the headline's longest word needs at an acceptable size. Below this
 * the hierarchy collapses and the composition is simply wrong for the content.
 */
function requiredHeadlineWidth(
  plan: DesignConceptPlan,
  typeScale: TypeScale,
  canvas: Canvas,
  dominance: number,
): number {
  const slot = plan.slots.find((s) => s.role === "headline");
  const style = typeScale.headline;
  if (!slot?.text || !style) return 0;
  const ideal = sizeFor(style, canvas) * (0.85 + slot.emphasis * 0.3) * (0.8 + dominance * 0.4);
  // 72% of the ideal size is the floor at which a headline still reads as one.
  const acceptable = ideal * 0.72;
  const transformed =
    style.transform === "uppercase" ? slot.text.toUpperCase() : slot.text;
  return longestWordWidth(transformed, {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: acceptable,
    letterSpacing: style.letterSpacing,
  });
}

interface Negotiation {
  applied: boolean;
  rects: Map<string, Rect>;
}

/**
 * Slide the subject outward (and shrink it a little) until the headline column
 * reaches the width it needs. A portrait may bleed off the canvas edge by up to
 * 18% of its width — designers do this constantly; a squashed headline is worse.
 */
function negotiateSubjects(
  regions: Regions,
  subjects: Rect[],
  gutter: number,
  requiredWidth: number,
  canvasWidth: number,
): Negotiation {
  const rects = new Map<string, Rect>();
  subjects.forEach((rect, i) => rects.set(i === 0 ? "subject" : `subject_${i + 1}`, { ...rect }));
  if (requiredWidth <= 0 || regions.textAlign === "center") return { applied: false, rects };

  const stack = regions.textStack;
  const primaryKey = "subject";
  const primary = rects.get(primaryKey);
  if (!primary) return { applied: false, rects };

  const available = Math.min(stack.width, primary.x - gutter - stack.x);
  const deficit = requiredWidth - available;
  if (deficit <= 1) return { applied: false, rects };

  const maxBleed = primary.width * 0.18;
  const alreadyBleeding = Math.max(0, primary.x + primary.width - canvasWidth);
  const slideRoom = Math.max(0, maxBleed - alreadyBleeding);
  const slide = Math.min(deficit, slideRoom);
  let applied = false;

  if (slide > 0) {
    primary.x += slide;
    applied = true;
  }

  const stillShort = deficit - slide;
  if (stillShort > 1) {
    // Shrink the subject, keeping it anchored to its bottom-right.
    const shrink = Math.min(stillShort, primary.width * 0.22);
    const scale = (primary.width - shrink) / primary.width;
    const bottom = primary.y + primary.height;
    const right = primary.x + primary.width;
    primary.width *= scale;
    primary.height *= scale;
    primary.x = right - primary.width;
    primary.y = bottom - primary.height;
    applied = true;
  }

  rects.set(primaryKey, primary);
  return { applied, rects };
}

/**
 * Pull the text column clear of any subject it would otherwise overlap.
 * When the subject sits low in the canvas the column takes the full width above
 * it instead of squeezing beside it — that is what gives the headline its scale.
 */
function constrainStack(regions: Regions, subjects: Rect[], gutter: number): Rect {
  let { x, width } = regions.textStack;
  let height = regions.textStack.height;
  const top = regions.textStack.y;
  const bottom = top + regions.textStack.height;
  const minWidth = regions.textStack.width * 0.42;

  for (const subject of subjects) {
    const verticalOverlap = subject.y < bottom && subject.y + subject.height > top;
    if (!verticalOverlap) continue;

    // The subject starts low enough that the whole width above it is free.
    if (subject.y > top + regions.textStack.height * 0.5) {
      height = Math.min(height, subject.y - gutter - top);
      continue;
    }
    const subjectRight = subject.x + subject.width;
    const stackRight = x + width;
    if (subject.x >= x + width * 0.5) {
      // Subject sits to the right of the column.
      const limit = subject.x - gutter;
      if (limit < stackRight) width = Math.max(minWidth, limit - x);
    } else if (subjectRight <= stackRight - width * 0.5) {
      // Subject sits to the left of the column.
      const limit = subjectRight + gutter;
      if (limit > x) {
        width = Math.max(minWidth, stackRight - limit);
        x = limit;
      }
    }
  }
  return { ...regions.textStack, x, width, height };
}

// ---------------------------------------------------------------- text stack

interface StackInput {
  plan: DesignConceptPlan;
  canvas: Canvas;
  typeScale: TypeScale;
  regions: Regions;
  palette: Palette;
  effectiveBackground: string;
  headlineBehind: boolean;
}

function buildTextStack(input: StackInput): Layer[] {
  const { plan, canvas, typeScale, regions, palette } = input;
  const stack = regions.textStack;
  const spacing = SPACING_MULTIPLIER[plan.dna.spacing] ?? 1;
  const unit = canvas.baselineUnit * spacing;
  const minSize = minimumFontSize(canvas);

  const slotByRole = new Map(plan.slots.map((s) => [s.role, s]));

  const build = (scale: number): Block[] => {
    const blocks: Block[] = [];

    for (const role of STACK_ORDER) {
      const slot = slotByRole.get(role);
      if (!slot?.text) continue;
      const block = makeBlock({
        role,
        text: slot.text,
        emphasis: slot.emphasis,
        colorRole: slot.colorRole,
        scale,
        input,
        width: stack.width,
        minSize,
        headlineDominance: regions.headlineDominance,
      });
      if (block) blocks.push({ ...block, gapBefore: (GAP_UNITS[role] ?? 1.5) * unit, inline: false });
    }

    const details = DETAIL_ROLES.map((role) => {
      const slot = slotByRole.get(role);
      if (!slot?.text) return null;
      return makeBlock({
        role,
        text: slot.text,
        emphasis: slot.emphasis,
        colorRole: slot.colorRole,
        scale,
        input,
        width: stack.width,
        minSize,
        headlineDominance: regions.headlineDominance,
      });
    }).filter((b): b is Omit<Block, "gapBefore" | "inline"> => b !== null);

    if (details.length > 0) {
      // Detail lines read as one horizontal band when they fit — a designer's
      // "SEP 13   9:00 AM   LEKKI" row — otherwise they stack.
      const gap = unit * 3;
      const totalWidth =
        details.reduce((sum, d) => sum + measuredWidth(d.layer), 0) + gap * (details.length - 1);
      const inline = details.length > 1 && totalWidth <= stack.width;
      details.forEach((d, i) => {
        blocks.push({
          ...d,
          gapBefore: i === 0 || !inline ? (i === 0 ? (GAP_UNITS as Record<string, number>).details! * unit : unit * 1.2) : 0,
          inline: inline && i > 0,
        });
      });
    }

    const cta = slotByRole.get("cta");
    if (cta?.text) {
      const block = makeBlock({
        role: "cta",
        text: cta.text,
        emphasis: cta.emphasis,
        colorRole: cta.colorRole,
        scale,
        input,
        width: stack.width,
        minSize,
        headlineDominance: regions.headlineDominance,
      });
      if (block) blocks.push({ ...block, gapBefore: (GAP_UNITS.cta ?? 2.6) * unit, inline: false });
    }

    return blocks;
  };

  // Fit the whole hierarchy into the stack region by scaling it as a unit —
  // this preserves the size *relationships* the planner asked for (§17).
  let scale = 1;
  let blocks = build(scale);
  for (let i = 0; i < 6; i += 1) {
    const total = stackHeight(blocks);
    if (total <= stack.height || scale <= 0.62) break;
    scale = Math.max(0.62, scale * Math.min(0.94, (stack.height / total) * 0.99));
    blocks = build(scale);
  }

  const total = stackHeight(blocks);
  let cursorY =
    regions.stackAnchor === "top"
      ? stack.y
      : regions.stackAnchor === "middle"
        ? // Optical centring — a block sitting on the exact centre reads as low.
          stack.y + Math.max(0, (stack.height - total) * 0.42)
        : stack.y + Math.max(0, stack.height - total);

  const out: Layer[] = [];
  let inlineX = stack.x;
  let inlineRowTop = cursorY;
  let z = 14;

  for (const block of blocks) {
    if (block.inline) {
      const width = measuredWidth(block.layer);
      const layer: TextLayer = {
        ...block.layer,
        x: px(inlineX),
        y: px(inlineRowTop),
        width: px(width),
        align: "left",
        zIndex: z++,
      };
      out.push(layer);
      inlineX += width + canvas.baselineUnit * SPACING_MULTIPLIER[plan.dna.spacing] * 3;
      continue;
    }

    cursorY += block.gapBefore;
    const layer: TextLayer = {
      ...block.layer,
      x: px(stack.x),
      y: px(cursorY),
      width: px(stack.width),
      align: regions.textAlign,
      zIndex: input.headlineBehind && block.role === "headline" ? 4 : z++,
    };
    out.push(layer);

    // Start of a potential inline row: remember where it began.
    inlineRowTop = cursorY;
    inlineX = stack.x + measuredWidth(layer) + canvas.baselineUnit * SPACING_MULTIPLIER[plan.dna.spacing] * 3;
    cursorY += layer.height;
  }

  return out;
}

function stackHeight(blocks: Block[]): number {
  return blocks.reduce((sum, b) => (b.inline ? sum : sum + b.gapBefore + b.layer.height), 0);
}

function measuredWidth(layer: TextLayer): number {
  return layer.lines.reduce((max, l) => Math.max(max, l.width), 0);
}

interface BlockInput {
  role: SlotRole;
  text: string;
  emphasis: number;
  colorRole: string;
  scale: number;
  input: StackInput;
  width: number;
  minSize: number;
  headlineDominance: number;
}

function makeBlock(b: BlockInput): Omit<Block, "gapBefore" | "inline"> | null {
  const style = b.input.typeScale[b.role] ?? b.input.typeScale.body;
  if (!style) return null;
  const canvas = b.input.canvas;

  const emphasisFactor = 0.85 + b.emphasis * 0.3;
  const dominance = b.role === "headline" ? 0.8 + b.headlineDominance * 0.4 : 1;
  const size = Math.max(b.minSize, sizeFor(style, canvas) * b.scale * emphasisFactor * dominance);

  const layout = layoutText({
    content: b.text,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: size,
    minFontSize: b.minSize,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    maxWidth: b.width,
    maxLines: MAX_LINES[b.role] ?? 3,
    transform: style.transform,
    fit: "shrink",
    balance: b.role === "headline" || b.role === "subheadline",
  });

  const color = resolveColor(b.input.palette, b.colorRole);
  const readable = ensureReadable(color, b.input.effectiveBackground, b.input.palette);

  return {
    role: b.role,
    text: b.text,
    layer: textLayer({
      id: b.role,
      slot: b.role,
      rect: { x: 0, y: 0, width: b.width, height: layout.height },
      content: b.text,
      style,
      size: layout.fontSize,
      align: "left",
      color: readable,
      layout,
      zIndex: 14,
    }),
  };
}

interface TextLayerInput {
  id: string;
  slot: SlotRole;
  rect: Rect;
  content: string;
  style: { fontFamily: string; fontWeight: number; lineHeight: number; letterSpacing: number; transform: TextLayer["transform"] };
  size: number;
  align: TextLayer["align"];
  color: string;
  layout: ReturnType<typeof layoutText>;
  zIndex: number;
}

function textLayer(i: TextLayerInput): TextLayer {
  return {
    type: "text",
    id: i.id,
    name: i.slot,
    slot: i.slot,
    x: px(i.rect.x),
    y: px(i.rect.y),
    width: px(i.rect.width),
    height: px(i.layout.height),
    rotation: 0,
    opacity: 1,
    zIndex: i.zIndex,
    visible: true,
    locked: false,
    blendMode: "normal",
    content: i.content,
    fontFamily: i.style.fontFamily,
    fontWeight: i.style.fontWeight,
    fontStyle: "normal",
    fontSize: px(i.size),
    lineHeight: i.style.lineHeight,
    letterSpacing: i.style.letterSpacing,
    align: i.align,
    verticalAlign: "top",
    transform: i.style.transform,
    color: i.color,
    maxLines: i.layout.lines.length || 1,
    fit: "shrink",
    lines: i.layout.lines.map((l) => ({ ...l, width: px(l.width), baseline: px(l.baseline) })),
    overflow: i.layout.overflow,
  };
}

function resolveColor(palette: Palette, role: string): string {
  switch (role) {
    case "accent":
      return palette.accent;
    case "accentAlt":
      return palette.accentAlt ?? palette.accent;
    case "inkMuted":
      return palette.inkMuted;
    case "surface":
      return palette.surface;
    case "background":
      return palette.background;
    default:
      return palette.ink;
  }
}

/** Never ship unreadable text — swap in the best available colour (§21). */
function ensureReadable(color: string, background: string, palette: Palette): string {
  if (contrastRatio(color, background) >= 3) return color;
  const candidates = [palette.ink, palette.surface, palette.accent, "#ffffff", "#111111"];
  return bestContrast(background, candidates);
}

// ------------------------------------------------------------------ imagery

interface SubjectInput {
  asset: AssetRefInfo;
  region: Rect;
  index: number;
  zIndex: number;
  fullBleed: boolean;
  anchor: "top" | "middle" | "bottom";
  treatments: DesignConceptPlan["subjectTreatment"];
}

function buildSubjectLayer(i: SubjectInput): Layer {
  const aspect = i.asset.width / Math.max(1, i.asset.height);
  let rect = i.region;

  if (!i.fullBleed) {
    const scale = Math.min(i.region.width / (i.region.height * aspect), 1);
    const height = i.region.height;
    const width = height * aspect * (scale < 1 ? scale : 1);
    const fitted = width > i.region.width ? i.region.width : width;
    const fittedHeight = fitted / aspect;
    rect = {
      x: i.region.x + (i.region.width - fitted) / 2,
      y:
        i.anchor === "bottom"
          ? i.region.y + i.region.height - fittedHeight
          : i.region.y + (i.region.height - fittedHeight) / 2,
      width: fitted,
      height: fittedHeight,
    };
  }

  return {
    type: "image",
    id: i.index === 0 ? "subject" : `subject_${i.index + 1}`,
    name: i.index === 0 ? "Subject" : `Subject ${i.index + 1}`,
    slot: i.index === 0 ? "subject" : "secondary-subject",
    x: px(rect.x),
    y: px(rect.y),
    width: px(rect.width),
    height: px(rect.height),
    rotation: 0,
    opacity: 1,
    zIndex: i.zIndex,
    visible: true,
    locked: false,
    blendMode: "normal",
    assetId: i.asset.id,
    maskAssetId: i.asset.cutout ? i.asset.id : null,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    fit: i.fullBleed ? "cover" : "contain",
    focalX: 0.5,
    focalY: i.asset.analysis?.eyeLevel ?? 0.4,
    treatments: i.treatments,
    adjustments: { brightness: 0, contrast: 0, saturation: 0, exposure: 0 },
    cornerRadius: 0,
    // §1.2 / §33 — the person's face is never regenerated or re-proportioned.
    immutable: true,
  };
}

function buildLogoLayer(asset: AssetRefInfo, regions: Regions, zIndex: number): Layer {
  const aspect = asset.width / Math.max(1, asset.height);
  const region = regions.logo;
  let width = region.width;
  let height = width / aspect;
  if (height > region.height) {
    height = region.height;
    width = height * aspect;
  }
  const x =
    regions.logoAlign === "center"
      ? region.x + (region.width - width) / 2
      : regions.logoAlign === "right"
        ? region.x + region.width - width
        : region.x;

  return {
    type: "image",
    id: "logo",
    name: "Logo",
    slot: "logo",
    x: px(x),
    y: px(region.y + (region.height - height) / 2),
    width: px(width),
    height: px(height),
    rotation: 0,
    opacity: 1,
    zIndex,
    visible: true,
    locked: true,
    blendMode: "normal",
    assetId: asset.id,
    maskAssetId: null,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    fit: "contain",
    focalX: 0.5,
    focalY: 0.5,
    treatments: [],
    adjustments: { brightness: 0, contrast: 0, saturation: 0, exposure: 0 },
    cornerRadius: 0,
    // §1.3 — logos are reproduced exactly, never redrawn.
    immutable: true,
  };
}
