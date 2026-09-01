import { contrastRatio, overlapRatio, type Rect } from "@gdp/core";
import {
  type DesignDocument,
  type ImageLayer,
  type Layer,
  type TextLayer,
  contentBox,
  isImage,
  isText,
  sortedLayers,
} from "@gdp/design-schema";
import type { AssetFacts, ComponentScore, QaContext, QaIssue } from "./types.js";
import { WEIGHTS } from "./types.js";

const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));

function component(name: keyof typeof WEIGHTS, issues: QaIssue[]): ComponentScore {
  const penalty = issues.reduce((sum, i) => sum + i.penalty, 0);
  return { name, weight: WEIGHTS[name], score: clamp100(100 - penalty), issues };
}

export function boundsOf(layer: Layer): Rect {
  if (isText(layer) && layer.lines.length > 0) {
    const width = layer.lines.reduce((max, l) => Math.max(max, l.width), 0);
    const x =
      layer.align === "center"
        ? layer.x + (layer.width - width) / 2
        : layer.align === "right"
          ? layer.x + layer.width - width
          : layer.x;
    return { x, y: layer.y, width, height: layer.height };
  }
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
}

// ------------------------------------------------------------- typography

export function checkTypography(doc: DesignDocument): ComponentScore {
  const issues: QaIssue[] = [];
  const texts = doc.layers.filter(isText).filter((l) => l.visible);
  const families = new Set(texts.map((t) => t.fontFamily));

  if (families.size > 3) {
    issues.push({
      code: "too-many-fonts",
      severity: "error",
      message: `${families.size} font families — a poster should hold to three at most`,
      penalty: 18 + (families.size - 3) * 6,
    });
  }

  const minSize = Math.max(14, Math.min(doc.canvas.width, doc.canvas.height) * 0.0115);
  for (const layer of texts) {
    if (layer.overflow) {
      issues.push({
        code: "text-overflow",
        severity: "error",
        message: `"${layer.slot}" does not fit its box and is clipped`,
        layerId: layer.id,
        penalty: 30,
      });
    }
    if (layer.fontSize < minSize) {
      issues.push({
        code: "text-too-small",
        severity: "error",
        message: `"${layer.slot}" is ${Math.round(layer.fontSize)}px — below the ${Math.round(minSize)}px legibility floor`,
        layerId: layer.id,
        penalty: 16,
      });
    }
    if (layer.lines.length > 1) {
      const last = layer.lines[layer.lines.length - 1]!;
      const words = last.text.trim().split(/\s+/).length;
      const first = layer.lines[0]!.text.trim().split(/\s+/).length;
      if (words === 1 && first > 2) {
        issues.push({
          code: "widow",
          severity: "warn",
          message: `"${layer.slot}" ends on a single stranded word`,
          layerId: layer.id,
          penalty: 8,
        });
      }
      const widths = layer.lines.map((l) => l.width);
      const maxW = Math.max(...widths);
      const minW = Math.min(...widths);
      if (maxW > 0 && minW / maxW < 0.45 && layer.slot === "headline") {
        issues.push({
          code: "ragged-headline",
          severity: "warn",
          message: "headline lines are very uneven in length",
          layerId: layer.id,
          penalty: 7,
        });
      }
    }
    // A broken word is the signature defect of naive layout engines.
    if (/\w-$/.test(layer.lines[0]?.text ?? "") === false && layer.lines.length > 1) {
      const joined = layer.lines.map((l) => l.text).join(" ");
      const original = layer.transform === "uppercase" ? layer.content.toUpperCase() : layer.content;
      if (joined.replace(/\s+/g, "") === original.replace(/\s+/g, "") && joined.split(/\s+/).length > original.split(/\s+/).length) {
        issues.push({
          code: "word-broken",
          severity: "error",
          message: `"${layer.slot}" has a word split across lines`,
          layerId: layer.id,
          penalty: 35,
        });
      }
    }
    if (layer.slot === "body" && layer.lines.length > 0) {
      const avgChars = layer.lines.reduce((s, l) => s + l.text.length, 0) / layer.lines.length;
      if (avgChars > 90) {
        issues.push({
          code: "line-too-long",
          severity: "warn",
          message: "body lines run past a comfortable measure",
          layerId: layer.id,
          penalty: 6,
        });
      }
    }
  }

  return component("typography", issues);
}

// ------------------------------------------------------------- composition

export function checkComposition(doc: DesignDocument): ComponentScore {
  const issues: QaIssue[] = [];
  const box = contentBox(doc.canvas);
  const visible = doc.layers.filter((l) => l.visible && l.slot !== "background" && l.slot !== "texture" && l.slot !== "overlay");

  // Nothing important may sit outside the safe content area.
  for (const layer of visible) {
    if (layer.slot === "subject" || layer.slot === "secondary-subject" || layer.slot === "decoration") continue;
    const b = boundsOf(layer);
    if (b.x < box.x - 1 || b.y < box.y - 1 || b.x + b.width > box.x + box.width + 1 || b.y + b.height > box.y + box.height + 1) {
      issues.push({
        code: "outside-safe-area",
        severity: "error",
        message: `"${layer.slot}" crosses the margin or safe area`,
        layerId: layer.id,
        penalty: 22,
      });
    }
  }

  // Text must not collide with other text, or with the subject's face.
  const texts = doc.layers.filter(isText).filter((l) => l.visible);
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = boundsOf(texts[i]!);
      const b = boundsOf(texts[j]!);
      if (overlapRatio(a, b) > 0.06) {
        issues.push({
          code: "text-collision",
          severity: "error",
          message: `"${texts[i]!.slot}" and "${texts[j]!.slot}" overlap`,
          layerId: texts[j]!.id,
          penalty: 26,
        });
      }
    }
  }

  const subject = doc.layers.find((l) => l.slot === "subject" && l.visible);
  if (subject && subject.type === "image") {
    const head = headRegion(subject);
    for (const text of texts) {
      if (text.slot === "headline" && sortedLayers(doc).findIndex((l) => l.id === text.id) < sortedLayers(doc).findIndex((l) => l.id === subject.id)) {
        continue; // deliberately behind the subject
      }
      if (overlapRatio(boundsOf(text), head) > 0.12) {
        issues.push({
          code: "text-over-face",
          severity: "error",
          message: `"${text.slot}" sits over the subject's face`,
          layerId: text.id,
          penalty: 28,
        });
      }
    }
  }

  // Visual balance: compare ink weight left vs right and top vs bottom.
  const balance = weightBalance(doc);
  if (balance.horizontal > 0.72) {
    issues.push({
      code: "unbalanced-horizontal",
      severity: "warn",
      message: "the design leans heavily to one side",
      penalty: 12 * (balance.horizontal - 0.72) * 4,
    });
  }
  if (balance.vertical > 0.78) {
    issues.push({
      code: "unbalanced-vertical",
      severity: "warn",
      message: "content is stacked at one end with dead space opposite",
      penalty: 10 * (balance.vertical - 0.78) * 4,
    });
  }

  // Emptiness: a poster that uses under a fifth of its canvas reads as unfinished.
  // Type covers less area than photography for the same visual presence, so a
  // design with no imagery is held to a lower — but still real — floor.
  const coverage = inkCoverage(doc);
  const hasImagery = doc.layers.some((l) => l.visible && l.type === "image" && l.slot !== "logo");
  const floor = hasImagery ? 0.22 : 0.13;
  if (coverage < floor) {
    issues.push({
      code: "sparse",
      severity: "warn",
      message: `only ${Math.round(coverage * 100)}% of the canvas carries content`,
      penalty: (floor - coverage) * 160,
    });
  }
  if (coverage > 0.82) {
    issues.push({
      code: "cluttered",
      severity: "warn",
      message: "very little breathing room left on the canvas",
      penalty: (coverage - 0.82) * 120,
    });
  }

  // Dead space: one big empty band across the canvas is the difference between
  // "deliberate whitespace" and "unfinished".
  const band = largestEmptyBand(doc);
  if (band.fraction > 0.26) {
    issues.push({
      code: "dead-space",
      severity: band.fraction > 0.4 ? "warn" : "info",
      message: `a ${Math.round(band.fraction * 100)}% tall band of the canvas is empty`,
      penalty: Math.min(26, (band.fraction - 0.26) * 90),
    });
  }

  // Alignment: elements should share edges rather than each finding its own.
  const edges = new Map<number, number>();
  for (const layer of visible) {
    const b = boundsOf(layer);
    const key = Math.round(b.x / 4) * 4;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  if (visible.length >= 4 && edges.size > Math.ceil(visible.length * 0.7)) {
    issues.push({
      code: "weak-alignment",
      severity: "warn",
      message: "elements do not share alignment lines",
      penalty: 10,
    });
  }

  return component("composition", issues);
}

/** Longest run of canvas rows with nothing on them, as a fraction of height. */
function largestEmptyBand(doc: DesignDocument): { fraction: number; start: number } {
  const step = 8;
  const rows = Math.ceil(doc.canvas.height / step);
  const occupied = new Array<boolean>(rows).fill(false);

  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    if (layer.slot === "background" || layer.slot === "texture" || layer.slot === "overlay") continue;
    const b = boundsOf(layer);
    const from = Math.max(0, Math.floor(b.y / step));
    const to = Math.min(rows - 1, Math.ceil((b.y + b.height) / step));
    for (let i = from; i <= to; i += 1) occupied[i] = true;
  }

  let best = 0;
  let bestStart = 0;
  let run = 0;
  for (let i = 0; i < rows; i += 1) {
    if (occupied[i]) {
      run = 0;
      continue;
    }
    run += 1;
    if (run > best) {
      best = run;
      bestStart = i - run + 1;
    }
  }
  return { fraction: best / rows, start: (bestStart * step) / doc.canvas.height };
}

function headRegion(subject: ImageLayer): Rect {
  const headHeight = subject.height * 0.3;
  return { x: subject.x + subject.width * 0.2, y: subject.y, width: subject.width * 0.6, height: headHeight };
}

function weightBalance(doc: DesignDocument): { horizontal: number; vertical: number } {
  const cx = doc.canvas.width / 2;
  const cy = doc.canvas.height / 2;
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  for (const layer of doc.layers) {
    if (!layer.visible || layer.slot === "background" || layer.slot === "texture") continue;
    // Use the column a text layer was allocated, not its tight glyph box —
    // otherwise every left-aligned editorial poster reads as "unbalanced".
    const b = isText(layer)
      ? { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
      : boundsOf(layer);
    const area = Math.max(1, b.width * b.height) * (isText(layer) ? 1.4 : 1);
    const centreX = b.x + b.width / 2;
    const centreY = b.y + b.height / 2;
    if (centreX < cx) left += area;
    else right += area;
    if (centreY < cy) top += area;
    else bottom += area;
  }
  const h = left + right === 0 ? 0 : Math.abs(left - right) / (left + right);
  const v = top + bottom === 0 ? 0 : Math.abs(top - bottom) / (top + bottom);
  return { horizontal: h, vertical: v };
}

function inkCoverage(doc: DesignDocument): number {
  const canvasArea = doc.canvas.width * doc.canvas.height;
  let covered = 0;
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    if (layer.slot === "background" || layer.slot === "texture" || layer.slot === "overlay") continue;
    const b = boundsOf(layer);
    covered += Math.max(0, b.width) * Math.max(0, b.height) * (isText(layer) ? 0.6 : 0.8);
  }
  return Math.min(1, covered / canvasArea);
}

// --------------------------------------------------------------- hierarchy

export function checkHierarchy(doc: DesignDocument): ComponentScore {
  const issues: QaIssue[] = [];
  const texts = doc.layers.filter(isText).filter((l) => l.visible);
  if (texts.length === 0) return component("hierarchy", issues);

  // The focal point is whichever role dominates: an event's title, or a
  // promotion's offer. A promo poster has no "headline" and needs none.
  const headline = texts.find((t) => t.slot === "offer") ?? texts.find((t) => t.slot === "headline");
  const others = texts.filter((t) => t.id !== headline?.id);

  if (headline && others.length > 0) {
    const nextLargest = Math.max(...others.map((t) => t.fontSize));
    const ratio = headline.fontSize / Math.max(1, nextLargest);
    if (ratio < 1.35) {
      issues.push({
        code: "weak-hierarchy",
        severity: "error",
        message: `headline is only ${ratio.toFixed(2)}× the next level — the eye has nowhere to land`,
        layerId: headline.id,
        penalty: 30 * (1.35 - ratio),
      });
    }
    // The reference ratio (§17) is ~0.089 of the short edge. Grade the shortfall
    // rather than using a cliff, so the ranker can tell 0.07 from 0.045.
    const shortEdge = Math.min(doc.canvas.width, doc.canvas.height);
    const ratioToCanvas = headline.fontSize / shortEdge;
    if (ratioToCanvas < 0.075) {
      issues.push({
        code: "small-headline",
        severity: ratioToCanvas < 0.05 ? "warn" : "info",
        message: `headline is ${(ratioToCanvas * 100).toFixed(1)}% of the short edge — a display headline wants ~8–9%`,
        layerId: headline.id,
        penalty: Math.min(34, (0.075 - ratioToCanvas) * 700),
      });
    }
  } else if (!headline) {
    issues.push({
      code: "no-focal-point",
      severity: "error",
      message: "nothing dominates — the design has no focal point",
      penalty: 35,
    });
  }

  const sizes = [...new Set(texts.map((t) => Math.round(t.fontSize)))];
  if (texts.length >= 4 && sizes.length < 3) {
    issues.push({
      code: "flat-hierarchy",
      severity: "warn",
      message: "everything is set at nearly the same size",
      penalty: 15,
    });
  }

  return component("hierarchy", issues);
}

// ----------------------------------------------------------------- spacing

export function checkSpacing(doc: DesignDocument): ComponentScore {
  const issues: QaIssue[] = [];
  const box = contentBox(doc.canvas);
  const texts = doc.layers
    .filter(isText)
    .filter((l) => l.visible)
    .sort((a, b) => a.y - b.y);

  for (let i = 1; i < texts.length; i += 1) {
    const previous = texts[i - 1]!;
    const current = texts[i]!;
    const gap = current.y - (previous.y + previous.height);
    if (gap < -1) continue; // overlap is a composition issue, counted there
    // Judge the gap against the *smaller* of the two sizes: a 150px offer
    // followed by 30px detail does not need a 20px gap to breathe.
    const reference = Math.min(previous.fontSize, current.fontSize);
    if (gap >= 0 && gap < reference * 0.3 && previous.slot !== current.slot) {
      issues.push({
        code: "crowded",
        severity: "warn",
        message: `"${previous.slot}" and "${current.slot}" are crowded together`,
        layerId: current.id,
        penalty: 9,
      });
    }
  }

  for (const layer of doc.layers) {
    if (!layer.visible || layer.slot === "background" || layer.slot === "texture" || layer.slot === "overlay") continue;
    if (layer.slot === "subject" || layer.slot === "secondary-subject" || layer.slot === "decoration") continue;
    const b = boundsOf(layer);
    const distances = [b.x - box.x, b.y - box.y, box.x + box.width - (b.x + b.width), box.y + box.height - (b.y + b.height)];
    const tight = distances.filter((d) => d < -1);
    if (tight.length > 0) {
      issues.push({
        code: "margin-violation",
        severity: "error",
        message: `"${layer.slot}" breaks the margin`,
        layerId: layer.id,
        penalty: 18,
      });
    }
  }

  return component("spacing", issues);
}

// ---------------------------------------------------------------- contrast

export function checkContrast(doc: DesignDocument, ctx: QaContext): ComponentScore {
  const issues: QaIssue[] = [];
  const texts = doc.layers.filter(isText).filter((l) => l.visible);

  for (const layer of texts) {
    const background = backgroundBehind(doc, layer, ctx);
    const ratio = contrastRatio(layer.color, background);
    // Large display text is legible at a lower ratio than small type.
    const required = layer.fontSize >= 48 ? 3 : layer.fontSize >= 24 ? 3.6 : 4.5;
    if (ratio < required) {
      issues.push({
        code: "low-contrast",
        severity: ratio < required * 0.72 ? "error" : "warn",
        message: `"${layer.slot}" has ${ratio.toFixed(1)}:1 contrast against its background (needs ${required}:1)`,
        layerId: layer.id,
        penalty: Math.min(40, (required - ratio) * 18),
      });
    }
  }

  return component("contrast", issues);
}

/** Best estimate of what sits directly behind a text layer. */
function backgroundBehind(doc: DesignDocument, layer: TextLayer, ctx: QaContext): string {
  const bounds = boundsOf(layer);
  const below = sortedLayers(doc).filter((l) => l.visible && l.zIndex < layer.zIndex);
  for (const candidate of [...below].reverse()) {
    if (overlapRatio(bounds, boundsOf(candidate)) < 0.3) continue;
    if (candidate.type === "shape" && candidate.fill?.type === "solid" && candidate.opacity > 0.6) {
      return candidate.fill.color;
    }
    if (isImage(candidate)) {
      const facts: AssetFacts | undefined = ctx.assets?.[candidate.assetId];
      if (facts?.averageColor) return facts.averageColor;
    }
  }
  const bg = doc.canvas.background;
  if (bg.type === "solid") return bg.color;
  if (bg.type === "linear-gradient" || bg.type === "radial-gradient") return bg.stops[0]?.color ?? doc.palette.background;
  return doc.palette.background;
}

// --------------------------------------------------------- asset integrity

export function checkAssetIntegrity(doc: DesignDocument, ctx: QaContext): ComponentScore {
  const issues: QaIssue[] = [];

  for (const layer of doc.layers) {
    if (!isImage(layer) || !layer.visible) continue;
    const facts = ctx.assets?.[layer.assetId];

    if (layer.immutable && layer.treatments.some((t) => t.type !== "none") && layer.slot === "logo") {
      issues.push({
        code: "logo-altered",
        severity: "error",
        message: "a treatment is being applied to the logo — logos must render exactly as supplied",
        layerId: layer.id,
        penalty: 45,
      });
    }

    if (facts) {
      const nativeAspect = facts.width / Math.max(1, facts.height);
      const drawnAspect = layer.width / Math.max(1, layer.height);
      if (layer.fit === "fill" && Math.abs(nativeAspect - drawnAspect) / nativeAspect > 0.04) {
        issues.push({
          code: "aspect-distorted",
          severity: "error",
          message: `"${layer.slot}" is stretched out of its natural proportions`,
          layerId: layer.id,
          penalty: 40,
        });
      }
      const scale = layer.width / Math.max(1, facts.width);
      if (scale > 1.5) {
        issues.push({
          code: "low-resolution",
          severity: scale > 2.2 ? "error" : "warn",
          message: `"${layer.slot}" is drawn ${scale.toFixed(1)}× larger than the uploaded file — it will look soft`,
          layerId: layer.id,
          penalty: Math.min(30, (scale - 1.5) * 25),
        });
      }
    }
  }

  return component("assetIntegrity", issues);
}

// -------------------------------------------------------- style coherence

export function checkStyleCoherence(doc: DesignDocument): ComponentScore {
  const issues: QaIssue[] = [];
  const palette = new Set(
    [doc.palette.background, doc.palette.surface, doc.palette.ink, doc.palette.inkMuted, doc.palette.accent, doc.palette.accentAlt].filter(
      Boolean,
    ) as string[],
  );

  const strays = doc.layers.filter(isText).filter((l) => l.visible && !palette.has(l.color));
  if (strays.length > 0) {
    issues.push({
      code: "off-palette",
      severity: "warn",
      message: `${strays.length} text layer(s) use colours outside the palette`,
      penalty: Math.min(24, strays.length * 8),
    });
  }

  const decorations = doc.layers.filter((l) => l.slot === "decoration" && l.visible);
  if (decorations.length > 6) {
    issues.push({
      code: "decoration-noise",
      severity: "warn",
      message: "too many decorative elements competing with the content",
      penalty: 14,
    });
  }

  const accentUsers = doc.layers.filter(isText).filter((l) => l.visible && l.color === doc.palette.accent);
  if (accentUsers.length > 3) {
    issues.push({
      code: "accent-overused",
      severity: "warn",
      message: "the accent colour loses its power when it is on everything",
      penalty: 10,
    });
  }

  return component("styleCoherence", issues);
}

// --------------------------------------------------------------- technical

export function checkTechnical(doc: DesignDocument, ctx: QaContext): ComponentScore {
  const issues: QaIssue[] = [];

  for (const layer of doc.layers) {
    const values = [layer.x, layer.y, layer.width, layer.height];
    if (values.some((v) => !Number.isFinite(v))) {
      issues.push({
        code: "invalid-geometry",
        severity: "error",
        message: `"${layer.slot}" has a non-finite coordinate`,
        layerId: layer.id,
        penalty: 60,
      });
    }
    if (isImage(layer) && ctx.assets && !ctx.assets[layer.assetId]) {
      issues.push({
        code: "missing-asset",
        severity: "error",
        message: `"${layer.slot}" references an asset that is not attached`,
        layerId: layer.id,
        penalty: 40,
      });
    }
  }

  const ids = doc.layers.map((l) => l.id);
  if (new Set(ids).size !== ids.length) {
    issues.push({ code: "duplicate-ids", severity: "error", message: "duplicate layer ids", penalty: 50 });
  }

  return component("technical", issues);
}
