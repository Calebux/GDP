import type { Canvas, TypeScale, TypeStyle, TypographyPlan } from "@gdp/design-schema";
import { familyMeta } from "@gdp/fonts";

/**
 * §17 — the optical hierarchy. Sizes are expressed as a ratio of the canvas
 * short edge so that a resize recomposes rather than stretches (§28).
 * The PRD's worked example (96 / 32 / 24 / 18 / 16 on a 1080 canvas) sits at
 * scaleContrast ≈ 2.6, which is the default.
 */
const ROLE_RATIO: Record<string, number> = {
  eyebrow: 0.0222,
  headline: 0.089,
  subheadline: 0.0315,
  body: 0.0198,
  date: 0.0296,
  time: 0.0259,
  location: 0.0167,
  cta: 0.0148,
  footer: 0.0132,
};

const ROLE_WEIGHT: Record<string, number> = {
  eyebrow: 600,
  headline: 800,
  subheadline: 500,
  body: 400,
  date: 700,
  time: 600,
  location: 500,
  cta: 600,
  footer: 400,
};

const HEADLINE_ROLES = new Set(["headline"]);
const ACCENT_ROLES = new Set(["eyebrow", "date", "cta"]);

const DENSITY: Record<string, { lineHeight: number; supportScale: number }> = {
  airy: { lineHeight: 1.5, supportScale: 0.94 },
  balanced: { lineHeight: 1.32, supportScale: 1 },
  dense: { lineHeight: 1.18, supportScale: 1.06 },
};

const REFERENCE_CONTRAST = 2.6;

export function buildTypeScale(plan: TypographyPlan, canvas: Canvas): TypeScale {
  const density = DENSITY[plan.density] ?? DENSITY.balanced!;
  const contrastFactor = Math.pow(plan.scaleContrast / REFERENCE_CONTRAST, 0.8);
  const scale: TypeScale = {};

  for (const [role, ratio] of Object.entries(ROLE_RATIO)) {
    const isHeadline = HEADLINE_ROLES.has(role);
    const family = isHeadline
      ? plan.headlineFont
      : ACCENT_ROLES.has(role) && plan.accentFont
        ? plan.accentFont
        : plan.supportFont;
    const meta = familyMeta(family);
    const availableWeights = meta?.weights ?? [400];
    const wanted = ROLE_WEIGHT[role] ?? 400;
    const weight = availableWeights.reduce((best, w) =>
      Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best,
    );

    const sizeRatio = isHeadline
      ? ratio * contrastFactor
      : ratio * density.supportScale * (1 / Math.pow(contrastFactor, 0.15));

    const style: TypeStyle = {
      fontFamily: family,
      fontWeight: weight,
      sizeRatio: clampRatio(sizeRatio),
      lineHeight: isHeadline ? headlineLineHeight(plan) : density.lineHeight,
      letterSpacing: isHeadline
        ? plan.headlineTracking
        : (meta?.defaultTracking ?? 0) + (role === "eyebrow" || role === "cta" ? 0.08 : 0),
      transform:
        isHeadline
          ? plan.headlineCase
          : role === "eyebrow" || role === "cta"
            ? "uppercase"
            : "none",
    };
    scale[role] = style;
  }
  // The minimum-size floor depends on the canvas, so bake it in here.
  return enforceLegibility(scale, canvas);
}

function headlineLineHeight(plan: TypographyPlan): number {
  // Big display type needs tighter leading than body copy to read as one block.
  const base = plan.density === "dense" ? 0.92 : plan.density === "airy" ? 1.06 : 0.98;
  return Math.min(1.3, Math.max(0.82, base));
}

function clampRatio(r: number): number {
  return Math.min(0.4, Math.max(0.008, r));
}

/** Nothing may render below the legibility floor (§17). */
export function minimumFontSize(canvas: Canvas): number {
  return Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.0115));
}

function enforceLegibility(scale: TypeScale, canvas: Canvas): TypeScale {
  const shortEdge = Math.min(canvas.width, canvas.height);
  const floor = minimumFontSize(canvas) / shortEdge;
  const out: TypeScale = {};
  for (const [role, style] of Object.entries(scale)) {
    out[role] = { ...style, sizeRatio: Math.max(floor, style.sizeRatio) };
  }
  return out;
}

export function sizeFor(style: TypeStyle, canvas: Canvas): number {
  return Math.round(style.sizeRatio * Math.min(canvas.width, canvas.height));
}

export function styleFor(scale: TypeScale, role: string): TypeStyle | undefined {
  return scale[role] ?? scale.body;
}
