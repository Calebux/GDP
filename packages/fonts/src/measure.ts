import * as fontkit from "fontkit";
import type { Font } from "fontkit";
import { resolveFont } from "./registry.js";

export interface FontMetrics {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  capHeight: number;
  xHeight: number;
}

export interface TextSpec {
  fontFamily: string;
  fontWeight?: number;
  italic?: boolean;
  fontSize: number;
  /** em units, matching the schema. */
  letterSpacing?: number;
}

const fonts = new Map<string, Font>();

function openFont(filePath: string): Font | null {
  const cached = fonts.get(filePath);
  if (cached) return cached;
  try {
    const opened = fontkit.openSync(filePath);
    const font = "fonts" in opened ? (opened.fonts[0] as Font | undefined) : (opened as Font);
    if (!font) return null;
    fonts.set(filePath, font);
    return font;
  } catch {
    return null;
  }
}

function fontFor(spec: TextSpec): Font | null {
  const file = resolveFont(spec.fontFamily, spec.fontWeight ?? 400, spec.italic ?? false);
  return file ? openFont(file.path) : null;
}

/**
 * Fallback metrics for when no font file is installed yet. Chosen to be close
 * to a normal-width grotesque so layout stays sane in a fresh checkout.
 */
const FALLBACK: FontMetrics = {
  unitsPerEm: 1000,
  ascent: 950,
  descent: -250,
  lineGap: 0,
  capHeight: 700,
  xHeight: 520,
};

export function metricsFor(spec: TextSpec): FontMetrics {
  const font = fontFor(spec);
  if (!font) return FALLBACK;
  return {
    unitsPerEm: font.unitsPerEm,
    ascent: font.ascent,
    descent: font.descent,
    lineGap: font.lineGap,
    capHeight: font.capHeight,
    xHeight: font.xHeight,
  };
}

/** Height of one line box in px, before any lineHeight multiplier. */
export function naturalLineHeight(spec: TextSpec): number {
  const m = metricsFor(spec);
  return ((m.ascent - m.descent + m.lineGap) / m.unitsPerEm) * spec.fontSize;
}

export function ascentPx(spec: TextSpec): number {
  const m = metricsFor(spec);
  return (m.ascent / m.unitsPerEm) * spec.fontSize;
}

export function capHeightPx(spec: TextSpec): number {
  const m = metricsFor(spec);
  return (m.capHeight / m.unitsPerEm) * spec.fontSize;
}

const FALLBACK_AVG_ADVANCE = 0.52;

/**
 * Advance width of a string in px, including tracking. This is *the* number the
 * whole typography engine trusts, and the renderer draws with the same font
 * file, so measured width and painted width agree.
 */
export function measureText(text: string, spec: TextSpec): number {
  if (text.length === 0) return 0;
  const tracking = (spec.letterSpacing ?? 0) * spec.fontSize;
  const font = fontFor(spec);
  if (!font) {
    return text.length * FALLBACK_AVG_ADVANCE * spec.fontSize + Math.max(0, text.length - 1) * tracking;
  }
  const run = font.layout(text);
  const width = (run.advanceWidth / font.unitsPerEm) * spec.fontSize;
  return width + Math.max(0, [...text].length - 1) * tracking;
}

/** True when the font can draw every character — protects non-Latin briefs. */
export function supportsText(text: string, spec: TextSpec): boolean {
  const font = fontFor(spec);
  if (!font) return true;
  for (const ch of text) {
    if (ch === "\n" || ch === " ") continue;
    if (!font.hasGlyphForCodePoint(ch.codePointAt(0)!)) return false;
  }
  return true;
}

export function clearMeasureCache(): void {
  fonts.clear();
}
