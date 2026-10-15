import {
  FORMATS,
  type Canvas,
  type CompositionArchetype,
  type DesignConceptPlan,
  type DesignDocument,
  type AssetKind,
  type FormatId,
  type SlotPlan,
  isText,
} from "@gdp/design-schema";
import { composeDocument, type AssetRefInfo } from "./compose.js";

/** Platform chrome that must stay clear of text, as a fraction of height. */
const SAFE_AREAS: Partial<Record<FormatId, { top: number; bottom: number }>> = {
  story: { top: 0.13, bottom: 0.14 },
  "ig-portrait": { top: 0, bottom: 0.02 },
  "youtube-thumb": { top: 0, bottom: 0.06 },
};

export function canvasFor(format: FormatId, overrides: Partial<Canvas> = {}): Canvas {
  const f = FORMATS[format];
  const shortEdge = Math.min(f.width, f.height);
  const safe = SAFE_AREAS[format];
  return {
    width: f.width,
    height: f.height,
    format,
    dpi: format.startsWith("flyer") ? 300 : 72,
    margin: Math.round(shortEdge * 0.065),
    safeArea: {
      top: Math.round((safe?.top ?? 0) * f.height),
      right: 0,
      bottom: Math.round((safe?.bottom ?? 0) * f.height),
      left: 0,
    },
    bleed: format.startsWith("flyer") ? Math.round(shortEdge * 0.0125) : 0,
    background: { type: "solid", color: "#0b0b0f", opacity: 1 },
    columns: 12,
    gutter: Math.round(shortEdge * 0.022),
    baselineUnit: Math.max(4, Math.round(shortEdge * 0.0074)),
    ...overrides,
  };
}

/** Landscape and square canvases need different compositions, not the same one squashed. */
function archetypeForAspect(archetype: CompositionArchetype, aspect: number): CompositionArchetype {
  const centred: CompositionArchetype[] = [
    "portrait-center-headline-above",
    "portrait-center-headline-behind",
    "stacked-center-minimal",
    "two-person-split",
    "three-speaker-row",
  ];
  if (aspect >= 1.25 && centred.includes(archetype)) return "portrait-right-headline-left";
  if (aspect >= 1.25 && archetype === "typographic-poster") return "typographic-poster";
  if (aspect <= 0.62 && archetype === "editorial-grid") return "portrait-center-headline-above";
  return archetype;
}

/** Emphasis the planner gives each role, for documents composed before plans were stored. */
const DEFAULT_EMPHASIS: Partial<Record<SlotPlan["role"], number>> = {
  eyebrow: 0.4,
  headline: 0.95,
  offer: 0.98,
  "offer-detail": 0.5,
  "promo-code": 0.5,
  subheadline: 0.5,
  body: 0.4,
  date: 0.7,
  time: 0.5,
  location: 0.45,
  cta: 0.55,
  footer: 0.2,
  logo: 0.3,
  subject: 0.9,
  "secondary-subject": 0.8,
};

/**
 * Rebuild a plan from a document. Text edits, palette changes and font swaps
 * live in the document, so a resize keeps everything the user changed while
 * letting the layout engine re-solve the geometry (§28). Everything the
 * document cannot express — emphasis, decoration, treatments, DNA — comes from
 * the plan it was composed from.
 */
export function documentToPlan(doc: DesignDocument): DesignConceptPlan {
  const original = doc.meta.plan;
  const emphasisOf = (role: SlotPlan["role"]): number =>
    original?.slots.find((s) => s.role === role)?.emphasis ?? DEFAULT_EMPHASIS[role] ?? 0.5;
  const slots: SlotPlan[] = [];

  for (const layer of doc.layers) {
    if (isText(layer)) {
      slots.push({
        role: layer.slot,
        text: layer.content,
        emphasis: emphasisOf(layer.slot),
        styleKey: layer.slot,
        colorRole: colorRoleOf(doc, layer.color),
        notes: layer.intent ?? undefined,
      });
    } else if (layer.type === "image" && layer.slot !== "background") {
      // Image slots are keyed by asset id; resizeDocument hands compose assets
      // whose ref is that same id, so the lookup lands.
      slots.push({
        role: layer.slot,
        assetRef: layer.assetId,
        emphasis: emphasisOf(layer.slot),
        styleKey: "body",
        colorRole: "ink",
      });
    }
  }

  // A promotion's dominant line is the offer, not a headline — read the display
  // face from whichever one carries it.
  const texts = doc.layers.filter(isText);
  const headline = texts.find((l) => l.slot === "offer") ?? texts.find((l) => l.slot === "headline");
  const support = texts.find((l) => l.id !== headline?.id && l.slot !== "eyebrow") ?? texts.find((l) => l.id !== headline?.id);

  return {
    conceptName: original?.conceptName ?? doc.meta.title,
    rationale: doc.meta.notes,
    archetype: (doc.meta.composition as CompositionArchetype) || original?.archetype || "portrait-right-headline-left",
    background: backgroundPlanFrom(doc),
    palette: {
      name: doc.palette.name,
      background: doc.palette.background,
      surface: doc.palette.surface,
      ink: doc.palette.ink,
      inkMuted: doc.palette.inkMuted,
      accent: doc.palette.accent,
      ...(doc.palette.accentAlt ? { accentAlt: doc.palette.accentAlt } : {}),
    },
    typography: {
      ...(original?.typography ?? { scaleContrast: 2.6, density: "balanced" as const }),
      headlineFont: headline?.fontFamily ?? original?.typography.headlineFont ?? "Archivo Black",
      supportFont: support?.fontFamily ?? original?.typography.supportFont ?? "Inter",
      headlineCase: (headline?.transform ?? original?.typography.headlineCase ?? "uppercase") as
        | "none"
        | "uppercase"
        | "capitalize",
      headlineTracking: headline?.letterSpacing ?? original?.typography.headlineTracking ?? -0.02,
      headlineAlign: (headline?.align ?? original?.typography.headlineAlign ?? "left") as "left" | "center" | "right",
    },
    dna: original?.dna ?? { energy: 0.6, minimalism: 0.5, contrast: 0.8, spacing: "balanced" },
    slots,
    decorations: original?.decorations ?? [],
    subjectTreatment: original?.subjectTreatment ?? [],
  };
}

const KIND_FOR_SLOT: Partial<Record<string, AssetKind>> = {
  logo: "logo",
  subject: "portrait",
  "secondary-subject": "portrait",
  background: "photo",
};

/**
 * The assets a document's image layers need, keyed so that `ref === id` — the
 * form documentToPlan writes. Caller-supplied facts (true size, cutout,
 * analysis) win; otherwise they are recovered from the layer itself, which is
 * enough to keep a photo or logo in the pack rather than silently dropping it.
 */
export function assetsForDocument(doc: DesignDocument, supplied: AssetRefInfo[] = []): AssetRefInfo[] {
  const byId = new Map(supplied.map((a) => [a.id, a]));
  const out = new Map<string, AssetRefInfo>();
  for (const layer of doc.layers) {
    if (layer.type !== "image" || out.has(layer.assetId)) continue;
    const known = byId.get(layer.assetId);
    out.set(
      layer.assetId,
      known
        ? { ...known, ref: layer.assetId }
        : {
            id: layer.assetId,
            ref: layer.assetId,
            kind: KIND_FOR_SLOT[layer.slot] ?? "photo",
            // Contained images were fitted at their native aspect, so the drawn
            // box carries it; full-bleed covers are cropped and cover again.
            width: Math.max(1, layer.width),
            height: Math.max(1, layer.height),
            cutout: layer.maskAssetId !== null,
            analysis: undefined,
          },
    );
  }
  return [...out.values()];
}

function colorRoleOf(doc: DesignDocument, color: string): SlotPlan["colorRole"] {
  const p = doc.palette;
  if (color === p.accent) return "accent";
  if (color === p.accentAlt) return "accentAlt";
  if (color === p.inkMuted) return "inkMuted";
  if (color === p.surface) return "surface";
  return "ink";
}

function backgroundPlanFrom(doc: DesignDocument): DesignConceptPlan["background"] {
  const photo = doc.layers.find((l) => l.type === "image" && l.slot === "background");
  if (photo && photo.type === "image") {
    const scrim = doc.layers.find((l) => l.slot === "overlay" && l.type === "shape");
    return { type: "photo", assetRef: photo.assetId, darken: scrim?.opacity ?? 0.45, blur: 0 };
  }
  const texture = doc.layers.find((l) => l.type === "texture" && l.slot === "texture");
  if (texture && texture.type === "texture") {
    return {
      type: "texture",
      texture: texture.texture as "grain" | "halftone" | "mesh" | "rays" | "grid" | "topography",
      color: texture.color,
      baseColor: texture.baseColor ?? doc.palette.background,
      intensity: texture.intensity,
    };
  }
  const bg = doc.canvas.background;
  if (bg.type === "linear-gradient") {
    return {
      type: "gradient",
      from: bg.stops[0]?.color ?? doc.palette.background,
      to: bg.stops[bg.stops.length - 1]?.color ?? doc.palette.surface,
      angle: bg.angle,
    };
  }
  return { type: "solid", color: doc.palette.background };
}

export interface ResizeInput {
  doc: DesignDocument;
  format: FormatId;
  assets: AssetRefInfo[];
  id?: string;
}

/** §28 — "Resize Campaign": recompose for a new format, never stretch. */
export function resizeDocument(input: ResizeInput): DesignDocument {
  const target = canvasFor(input.format);
  const aspect = target.width / target.height;
  const plan = documentToPlan(input.doc);
  plan.archetype = archetypeForAspect(plan.archetype, aspect);

  const { doc } = composeDocument({
    id: input.id ?? `${input.doc.id}_${input.format}`,
    canvas: target,
    plan,
    assets: assetsForDocument(input.doc, input.assets),
    meta: { ...input.doc.meta, composition: plan.archetype },
  });
  return doc;
}

export function resizeCampaign(
  doc: DesignDocument,
  assets: AssetRefInfo[],
  formats: FormatId[],
): Record<string, DesignDocument> {
  const out: Record<string, DesignDocument> = {};
  for (const format of formats) {
    out[format] = resizeDocument({ doc, format, assets });
  }
  return out;
}
