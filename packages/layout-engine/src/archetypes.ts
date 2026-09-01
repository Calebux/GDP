import type { Rect } from "@gdp/core";
import type { Canvas } from "@gdp/design-schema";
import { contentBox } from "@gdp/design-schema";
import type { CompositionArchetype } from "@gdp/design-schema";

export type Anchor = "top" | "middle" | "bottom";
export type Align = "left" | "center" | "right";

export interface Regions {
  /** Where portraits/cutouts go. Empty for typographic layouts. */
  subjects: Rect[];
  subjectAnchor: Anchor;
  /** Column the text hierarchy flows down. */
  textStack: Rect;
  textAlign: Align;
  stackAnchor: Anchor;
  logo: Rect;
  logoAlign: Align;
  footer: Rect;
  /** Headline sits *behind* the subject — the composition trick in §14 Concept B. */
  headlineBehindSubject: boolean;
  /** The subject photo covers the whole canvas rather than being a cutout. */
  fullBleedImage: boolean;
  overlay: "bottom-gradient" | "full-scrim" | "diagonal" | null;
  /** Hint for how much the headline may dominate, 0–1. */
  headlineDominance: number;
}

export interface ArchetypeOptions {
  /** Sourced from asset analysis (§8): the subject should face into the design. */
  subjectFacing?: "left" | "right" | "front" | "unknown";
  subjectCount?: number;
  spacing?: "tight" | "balanced" | "generous";
}

type Builder = (canvas: Canvas, box: Rect, opts: ArchetypeOptions) => Regions;

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Portrait cutouts read best when they touch the bottom edge of the canvas. */
function bottomBleed(canvas: Canvas, x: number, width: number, heightFraction: number): Rect {
  const height = canvas.height * heightFraction;
  return r(x, canvas.height - height, width, height);
}

const BUILDERS: Record<CompositionArchetype, Builder> = {
  "portrait-right-headline-left": (canvas, box) => ({
    subjects: [bottomBleed(canvas, canvas.width * 0.5, canvas.width * 0.6, 0.78)],
    subjectAnchor: "bottom",
    textStack: r(box.x, box.y + box.height * 0.08, box.width * 0.58, box.height * 0.7),
    textAlign: "left",
    stackAnchor: "middle",
    logo: r(box.x, box.y, box.width * 0.24, box.height * 0.055),
    logoAlign: "left",
    footer: r(box.x, box.y + box.height * 0.94, box.width * 0.55, box.height * 0.06),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.62,
  }),

  "portrait-left-headline-right": (canvas, box) => ({
    subjects: [bottomBleed(canvas, canvas.width * -0.1, canvas.width * 0.6, 0.78)],
    subjectAnchor: "bottom",
    textStack: r(box.x + box.width * 0.42, box.y + box.height * 0.08, box.width * 0.58, box.height * 0.7),
    textAlign: "right",
    stackAnchor: "middle",
    logo: r(box.x + box.width * 0.76, box.y, box.width * 0.24, box.height * 0.055),
    logoAlign: "right",
    footer: r(box.x + box.width * 0.45, box.y + box.height * 0.94, box.width * 0.55, box.height * 0.06),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.62,
  }),

  "portrait-center-headline-above": (canvas, box) => ({
    subjects: [bottomBleed(canvas, canvas.width * 0.16, canvas.width * 0.68, 0.62)],
    subjectAnchor: "bottom",
    textStack: r(box.x, box.y + box.height * 0.04, box.width, box.height * 0.36),
    textAlign: "center",
    stackAnchor: "top",
    logo: r(box.x + box.width * 0.35, box.y, box.width * 0.3, box.height * 0.05),
    logoAlign: "center",
    footer: r(box.x, box.y + box.height * 0.95, box.width, box.height * 0.05),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.55,
  }),

  "portrait-center-headline-behind": (canvas, box) => ({
    subjects: [bottomBleed(canvas, canvas.width * 0.18, canvas.width * 0.64, 0.72)],
    subjectAnchor: "bottom",
    textStack: r(box.x, box.y + box.height * 0.1, box.width, box.height * 0.42),
    textAlign: "center",
    stackAnchor: "top",
    logo: r(box.x + box.width * 0.35, box.y, box.width * 0.3, box.height * 0.05),
    logoAlign: "center",
    footer: r(box.x, box.y + box.height * 0.9, box.width, box.height * 0.1),
    headlineBehindSubject: true,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.78,
  }),

  "headline-dominant-portrait-small": (canvas, box) => ({
    subjects: [bottomBleed(canvas, canvas.width * 0.54, canvas.width * 0.46, 0.46)],
    subjectAnchor: "bottom",
    textStack: r(box.x, box.y + box.height * 0.02, box.width, box.height * 0.52),
    textAlign: "left",
    stackAnchor: "top",
    logo: r(box.x, box.y, box.width * 0.22, box.height * 0.05),
    logoAlign: "left",
    footer: r(box.x, box.y + box.height * 0.78, box.width * 0.5, box.height * 0.2),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.85,
  }),

  "full-bleed-image-bottom-stack": (canvas, box) => ({
    subjects: [r(0, 0, canvas.width, canvas.height)],
    subjectAnchor: "middle",
    textStack: r(box.x, box.y + box.height * 0.46, box.width * 0.92, box.height * 0.5),
    textAlign: "left",
    stackAnchor: "bottom",
    logo: r(box.x, box.y, box.width * 0.22, box.height * 0.05),
    logoAlign: "left",
    footer: r(box.x, box.y + box.height * 0.95, box.width, box.height * 0.05),
    headlineBehindSubject: false,
    fullBleedImage: true,
    overlay: "bottom-gradient",
    headlineDominance: 0.6,
  }),

  "split-diagonal": (canvas, box) => ({
    subjects: [bottomBleed(canvas, canvas.width * 0.4, canvas.width * 0.62, 0.72)],
    subjectAnchor: "bottom",
    textStack: r(box.x, box.y + box.height * 0.06, box.width * 0.5, box.height * 0.6),
    textAlign: "left",
    stackAnchor: "top",
    logo: r(box.x, box.y, box.width * 0.2, box.height * 0.05),
    logoAlign: "left",
    footer: r(box.x, box.y + box.height * 0.92, box.width * 0.5, box.height * 0.08),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: "diagonal",
    headlineDominance: 0.66,
  }),

  "editorial-grid": (canvas, box) => ({
    subjects: [r(box.x + box.width * 0.42, box.y + box.height * 0.3, box.width * 0.58, box.height * 0.52)],
    subjectAnchor: "bottom",
    textStack: r(box.x, box.y + box.height * 0.06, box.width * 0.68, box.height * 0.34),
    textAlign: "left",
    stackAnchor: "top",
    logo: r(box.x, box.y, box.width * 0.2, box.height * 0.04),
    logoAlign: "left",
    footer: r(box.x, box.y + box.height * 0.86, box.width, box.height * 0.14),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.72,
  }),

  "stacked-center-minimal": (canvas, box) => ({
    subjects: [bottomBleed(canvas, canvas.width * 0.28, canvas.width * 0.44, 0.4)],
    subjectAnchor: "bottom",
    textStack: r(box.x + box.width * 0.06, box.y + box.height * 0.16, box.width * 0.88, box.height * 0.42),
    textAlign: "center",
    stackAnchor: "top",
    logo: r(box.x + box.width * 0.4, box.y, box.width * 0.2, box.height * 0.045),
    logoAlign: "center",
    footer: r(box.x, box.y + box.height * 0.94, box.width, box.height * 0.06),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.5,
  }),

  "two-person-split": (canvas, box) => ({
    subjects: [
      bottomBleed(canvas, canvas.width * 0.0, canvas.width * 0.52, 0.6),
      bottomBleed(canvas, canvas.width * 0.48, canvas.width * 0.52, 0.6),
    ],
    subjectAnchor: "bottom",
    textStack: r(box.x, box.y + box.height * 0.04, box.width, box.height * 0.34),
    textAlign: "center",
    stackAnchor: "top",
    logo: r(box.x + box.width * 0.4, box.y, box.width * 0.2, box.height * 0.045),
    logoAlign: "center",
    footer: r(box.x, box.y + box.height * 0.94, box.width, box.height * 0.06),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.52,
  }),

  "three-speaker-row": (canvas, box) => {
    const w = canvas.width * 0.36;
    return {
      subjects: [
        bottomBleed(canvas, canvas.width * 0.0 - w * 0.08, w, 0.46),
        bottomBleed(canvas, canvas.width * 0.5 - w / 2, w, 0.5),
        bottomBleed(canvas, canvas.width - w * 0.92, w, 0.46),
      ],
      subjectAnchor: "bottom",
      textStack: r(box.x, box.y + box.height * 0.04, box.width, box.height * 0.36),
      textAlign: "center",
      stackAnchor: "top",
      logo: r(box.x + box.width * 0.4, box.y, box.width * 0.2, box.height * 0.045),
      logoAlign: "center",
      footer: r(box.x, box.y + box.height * 0.95, box.width, box.height * 0.05),
      headlineBehindSubject: false,
      fullBleedImage: false,
      overlay: null,
      headlineDominance: 0.5,
    };
  },

  "typographic-poster": (_canvas, box) => ({
    subjects: [],
    subjectAnchor: "bottom",
    textStack: r(box.x, box.y + box.height * 0.08, box.width, box.height * 0.7),
    textAlign: "left",
    stackAnchor: "middle",
    logo: r(box.x, box.y, box.width * 0.24, box.height * 0.05),
    logoAlign: "left",
    footer: r(box.x, box.y + box.height * 0.88, box.width, box.height * 0.12),
    headlineBehindSubject: false,
    fullBleedImage: false,
    overlay: null,
    headlineDominance: 0.95,
  }),
};

/**
 * Mirror an archetype when the subject faces the wrong way (§8): a speaker
 * looking left belongs on the right, facing into the headline.
 */
export function orientArchetype(
  archetype: CompositionArchetype,
  facing: "left" | "right" | "front" | "unknown" = "unknown",
): CompositionArchetype {
  if (facing === "left" && archetype === "portrait-left-headline-right") return "portrait-right-headline-left";
  if (facing === "right" && archetype === "portrait-right-headline-left") return "portrait-left-headline-right";
  return archetype;
}

export function regionsFor(
  archetype: CompositionArchetype,
  canvas: Canvas,
  opts: ArchetypeOptions = {},
): Regions {
  const builder = BUILDERS[archetype] ?? BUILDERS["portrait-right-headline-left"];
  const box = contentBox(canvas);
  const regions = builder(canvas, box, opts);
  const count = opts.subjectCount ?? regions.subjects.length;
  return { ...regions, subjects: regions.subjects.slice(0, Math.max(0, count)) };
}

export const ARCHETYPE_NAMES = Object.keys(BUILDERS) as CompositionArchetype[];
