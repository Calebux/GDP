import { metricsFor, measureText, type TextSpec } from "@gdp/fonts";
import type { TextLine } from "@gdp/design-schema";

export type TextTransformKind = "none" | "uppercase" | "lowercase" | "capitalize";
export type FitMode = "shrink" | "wrap" | "fixed";

export interface TextLayoutInput {
  content: string;
  fontFamily: string;
  fontWeight?: number;
  italic?: boolean;
  /** Starting size. `shrink` may reduce it; nothing ever grows it silently. */
  fontSize: number;
  minFontSize?: number;
  lineHeight: number;
  /** em units. */
  letterSpacing: number;
  maxWidth: number;
  maxHeight?: number;
  maxLines: number;
  transform?: TextTransformKind;
  fit?: FitMode;
  /** Even out ragged line widths — always on for headlines (§17). */
  balance?: boolean;
}

export interface TextLayoutResult {
  lines: TextLine[];
  fontSize: number;
  /** Widest measured line. */
  width: number;
  height: number;
  lineBox: number;
  /** Content did not fit even at the minimum size. */
  overflow: boolean;
  /** A final line carrying a single short word (§17). */
  widow: boolean;
}

export function applyTransform(text: string, transform: TextTransformKind = "none"): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    default:
      return text;
  }
}

function specOf(input: TextLayoutInput, fontSize: number): TextSpec {
  return {
    fontFamily: input.fontFamily,
    fontWeight: input.fontWeight ?? 400,
    italic: input.italic ?? false,
    fontSize,
    letterSpacing: input.letterSpacing,
  };
}

/**
 * Greedy wrap. Words are never broken mid-glyph unless `allowBreak` is set —
 * "SUPERNATURAL" must shrink to fit, never become "SUPERN / ATURAL".
 */
function wrap(text: string, spec: TextSpec, maxWidth: number, allowBreak = false): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (measureText(candidate, spec) <= maxWidth || line.length === 0) {
        if (measureText(candidate, spec) > maxWidth && line.length === 0 && allowBreak) {
          // Last resort: the word cannot fit even at the minimum size.
          const pieces = breakWord(word, spec, maxWidth);
          for (const piece of pieces.slice(0, -1)) out.push(piece);
          line = pieces[pieces.length - 1] ?? "";
          continue;
        }
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    if (line.length > 0) out.push(line);
  }
  return out;
}

/** Width of the widest unbreakable token — the real constraint on headline size. */
export function longestWordWidth(text: string, spec: TextSpec): number {
  let widest = 0;
  for (const word of text.split(/\s+/)) {
    if (word.length === 0) continue;
    widest = Math.max(widest, measureText(word, spec));
  }
  return widest;
}

function breakWord(word: string, spec: TextSpec, maxWidth: number): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const ch of word) {
    const next = current + ch;
    if (measureText(next, spec) > maxWidth && current.length > 0) {
      pieces.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current.length > 0) pieces.push(current);
  return pieces;
}

/**
 * Re-wrap at the narrowest width that still produces the same line count.
 * This is what stops "SUPERNATURAL INCREASE / NIGHT" from rendering as a long
 * line followed by a stub.
 */
function balanceLines(
  text: string,
  spec: TextSpec,
  maxWidth: number,
  lineCount: number,
  allowBreak: boolean,
): string[] {
  if (lineCount <= 1) return wrap(text, spec, maxWidth, allowBreak);
  const minWidth = longestWordWidth(text, spec);
  let lo = Math.max(1, minWidth);
  let hi = maxWidth;
  let best = wrap(text, spec, maxWidth, allowBreak);
  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    const candidate = wrap(text, spec, mid, allowBreak);
    if (candidate.length <= lineCount) {
      best = candidate;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

function toLines(raw: string[], spec: TextSpec, lineBox: number, ascent: number, halfLeading: number): TextLine[] {
  return raw.map((text, i) => ({
    text,
    width: measureText(text, spec),
    baseline: halfLeading + ascent + i * lineBox,
  }));
}

/**
 * §17 — the typography engine. Given a box and content, it produces the exact
 * lines that will be drawn. Overflow is impossible by construction: text either
 * fits, shrinks to fit, or is reported as overflowing so QA can reject it.
 */
export function layoutText(input: TextLayoutInput): TextLayoutResult {
  const transformed = applyTransform(input.content, input.transform);
  const fit = input.fit ?? "shrink";
  const minSize = input.minFontSize ?? 12;
  const maxWidth = Math.max(1, input.maxWidth);

  let fontSize = input.fontSize;
  let raw = wrap(transformed, specOf(input, fontSize), maxWidth);

  if (fit === "shrink") {
    // Shrink until the content respects the line budget, the box height *and*
    // fits its longest word without hyphenating.
    for (let guard = 0; guard < 60; guard += 1) {
      const spec = specOf(input, fontSize);
      raw = wrap(transformed, spec, maxWidth);
      const height = raw.length * fontSize * input.lineHeight;
      const fitsLines = raw.length <= input.maxLines;
      const fitsHeight = input.maxHeight === undefined || height <= input.maxHeight;
      const fitsWord = longestWordWidth(transformed, spec) <= maxWidth;
      if ((fitsLines && fitsHeight && fitsWord) || fontSize <= minSize) break;
      fontSize = Math.max(minSize, fontSize * 0.96);
    }
  }

  const spec = specOf(input, fontSize);
  // Only ever break a word when even the minimum size cannot contain it.
  const allowBreak = longestWordWidth(transformed, spec) > maxWidth;
  if (allowBreak) raw = wrap(transformed, spec, maxWidth, true);
  if (input.balance !== false) {
    const target = Math.min(raw.length, input.maxLines);
    if (target > 1) raw = balanceLines(transformed, spec, maxWidth, target, allowBreak);
  }

  const overflow =
    raw.length > input.maxLines ||
    (input.maxHeight !== undefined && raw.length * fontSize * input.lineHeight > input.maxHeight + 0.5);

  const clipped = raw.slice(0, input.maxLines);
  const m = metricsFor(spec);
  const contentHeight = ((m.ascent - m.descent) / m.unitsPerEm) * fontSize;
  const lineBox = fontSize * input.lineHeight;
  const halfLeading = (lineBox - contentHeight) / 2;
  const ascent = (m.ascent / m.unitsPerEm) * fontSize;
  const lines = toLines(clipped, spec, lineBox, ascent, halfLeading);

  const lastWords = clipped[clipped.length - 1]?.trim().split(/\s+/).length ?? 0;
  const widow = clipped.length > 1 && lastWords === 1 && (clipped[0]?.split(/\s+/).length ?? 0) > 2;

  return {
    lines,
    fontSize,
    width: lines.reduce((max, l) => Math.max(max, l.width), 0),
    height: lineBox * lines.length,
    lineBox,
    overflow,
    widow,
  };
}

/** Largest size at which `content` fits the box — used to set headline scale. */
export function fitSize(input: Omit<TextLayoutInput, "fontSize"> & { maxFontSize: number }): number {
  let lo = input.minFontSize ?? 12;
  let hi = input.maxFontSize;
  let best = lo;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    const result = layoutText({ ...input, fontSize: mid, fit: "wrap" });
    const fits =
      !result.overflow &&
      result.lines.length <= input.maxLines &&
      (input.maxHeight === undefined || result.height <= input.maxHeight);
    if (fits) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}
