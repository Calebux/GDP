import { darken, lighten, createLogger } from "@gdp/core";
import {
  type Canvas,
  type DesignDocument,
  type DesignPatch,
  type DesignPatchOp,
  type Layer,
  type PatchTarget,
  type SlotRole,
  type TextLayer,
  DesignPatch as DesignPatchSchema,
  enforceGuards,
  isText,
  nextZIndex,
} from "@gdp/design-schema";
import { fallbackFor, isAvailable } from "@gdp/fonts";
import { layoutText, minimumFontSize } from "@gdp/typography";
import { composeDocument, documentToPlan, type AssetRefInfo } from "@gdp/layout-engine";
import { structuredOrFallback } from "./llm.js";
import { editorSystemPrompt, editorUserPrompt } from "./prompts.js";

const log = createLogger("planner:edit");

const MAX_LINES: Partial<Record<SlotRole, number>> = {
  eyebrow: 1,
  headline: 3,
  subheadline: 2,
  body: 5,
  date: 1,
  time: 1,
  location: 2,
  cta: 1,
  footer: 2,
};

export interface ApplyResult {
  doc: DesignDocument;
  applied: string[];
  skipped: Array<{ op: string; reason: string }>;
}

/** A compact view of the design for the editing model — cheap tokens (§32). */
export function designDigest(doc: DesignDocument): string {
  const layers = doc.layers
    .filter((l) => l.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((l) => {
      const base = `${l.id} [${l.slot}] ${l.type} at ${Math.round(l.x)},${Math.round(l.y)} ${Math.round(l.width)}×${Math.round(l.height)}${l.locked ? " LOCKED" : ""}`;
      if (isText(l)) {
        return `${base} "${l.content}" ${l.fontFamily} ${l.fontWeight} ${Math.round(l.fontSize)}px ${l.color} align=${l.align}`;
      }
      return base;
    });
  return [
    `canvas ${doc.canvas.width}×${doc.canvas.height} margin ${doc.canvas.margin}`,
    `palette bg=${doc.palette.background} ink=${doc.palette.ink} muted=${doc.palette.inkMuted} accent=${doc.palette.accent}`,
    `composition ${doc.meta.composition}`,
    ...layers,
  ].join("\n");
}

export interface InterpretInput {
  doc: DesignDocument;
  instruction: string;
}

/** §24 — turn "make the date pop" into a validated patch. */
export async function interpretEdit(input: InterpretInput): Promise<{ patch: DesignPatch; usedModel: boolean }> {
  const { value, usedModel } = await structuredOrFallback(
    {
      task: "editor",
      system: editorSystemPrompt(),
      prompt: editorUserPrompt(designDigest(input.doc), input.instruction),
      schema: DesignPatchSchema,
      maxTokens: 1500,
      temperature: 0.3,
      toolName: "emit_design_patch",
    },
    () => heuristicPatch(input.doc, input.instruction),
  );
  return { patch: value, usedModel };
}

export interface ApplyContext {
  assets?: AssetRefInfo[];
}

export function applyPatch(doc: DesignDocument, patch: DesignPatch, ctx: ApplyContext = {}): ApplyResult {
  let working = structuredClone(doc);
  const applied: string[] = [];
  const skipped: Array<{ op: string; reason: string }> = [];

  for (const op of patch.ops) {
    const result = applyOp(working, op, ctx);
    working = result.doc;
    if (result.ok) applied.push(op.op);
    else skipped.push({ op: op.op, reason: result.reason });
  }

  const { doc: guarded } = enforceGuards(working, {
    fontAvailable: isAvailable,
    fontFallback: fallbackFor,
    minFontSize: minimumFontSize(working.canvas),
    maxFontFamilies: 3,
    bleedSlots: ["background", "texture", "overlay", "backdrop-shape", "decoration", "subject", "secondary-subject"],
  });

  log.info("applied patch", { summary: patch.summary, applied: applied.length, skipped: skipped.length });
  return { doc: guarded, applied, skipped };
}

type OpResult = { doc: DesignDocument; ok: true } | { doc: DesignDocument; ok: false; reason: string };

function applyOp(doc: DesignDocument, op: DesignPatchOp, ctx: ApplyContext): OpResult {
  switch (op.op) {
    case "recompose": {
      const plan = documentToPlan(doc);
      if (op.archetype) plan.archetype = op.archetype;
      if (op.spacing) plan.dna.spacing = op.spacing;
      if (op.scaleContrast) plan.typography.scaleContrast = op.scaleContrast;
      if (op.density) plan.typography.density = op.density;
      const assets: AssetRefInfo[] =
        ctx.assets ??
        doc.assetIds.map((id) => ({ id, ref: id, kind: "photo" as const, width: 1000, height: 1000 }));
      const { doc: composed } = composeDocument({
        id: doc.id,
        canvas: doc.canvas,
        plan,
        assets,
        meta: doc.meta,
      });
      return { doc: composed, ok: true };
    }

    case "set-palette": {
      const palette = { ...doc.palette };
      const previous = { ...doc.palette };
      for (const key of ["background", "surface", "ink", "inkMuted", "accent", "accentAlt", "name"] as const) {
        const value = op[key];
        if (value) (palette as Record<string, string>)[key] = value;
      }
      const next = { ...doc, palette };
      // Recolour any layer that was using a palette colour, so the change is coherent.
      next.layers = doc.layers.map((layer) => {
        if (!isText(layer)) return layer;
        const role = (Object.keys(previous) as Array<keyof typeof previous>).find(
          (k) => previous[k] === layer.color,
        );
        if (!role || role === "name") return layer;
        const replacement = palette[role as keyof typeof palette];
        return typeof replacement === "string" ? { ...layer, color: replacement } : layer;
      });
      if (op.background && doc.canvas.background.type === "solid") {
        next.canvas = { ...doc.canvas, background: { type: "solid", color: op.background, opacity: 1 } };
      }
      return { doc: next, ok: true };
    }

    case "set-background":
      return { doc: { ...doc, canvas: { ...doc.canvas, background: op.paint } }, ok: true };

    case "add-decoration": {
      const unit = Math.min(doc.canvas.width, doc.canvas.height);
      const color =
        op.colorRole === "accentAlt" ? (doc.palette.accentAlt ?? doc.palette.accent) : doc.palette[op.colorRole];
      const headline = doc.layers.find((l) => l.slot === "headline");
      const layer: Layer = {
        type: "shape",
        id: `decoration_${doc.layers.length + 1}`,
        name: op.kind,
        slot: "decoration",
        x: headline?.x ?? doc.canvas.margin,
        y: (headline?.y ?? doc.canvas.margin) - unit * 0.045,
        width: unit * (0.06 + op.intensity * 0.12),
        height: Math.max(4, unit * 0.008),
        rotation: 0,
        opacity: 1,
        zIndex: nextZIndex(doc),
        visible: true,
        locked: false,
        blendMode: "normal",
        shape: op.kind === "circle-badge" ? "ellipse" : "rect",
        fill: { type: "solid", color, opacity: 1 },
        cornerRadius: 0,
        sides: 6,
      };
      return { doc: { ...doc, layers: [...doc.layers, layer] }, ok: true };
    }

    default:
      break;
  }

  const target = resolveTarget(doc, op.target);
  if (!target) return { doc, ok: false, reason: "no layer matched the target" };
  if (target.locked && op.op !== "set-visibility") {
    return { doc, ok: false, reason: `"${target.slot}" is locked — brand assets are never restyled` };
  }

  const layers = doc.layers.map((layer) => {
    if (layer.id !== target.id) return layer;
    return mutate(layer, op, doc.canvas);
  });
  return { doc: { ...doc, layers }, ok: true };
}

function mutate(layer: Layer, op: DesignPatchOp, canvas: Canvas): Layer {
  switch (op.op) {
    case "set-text":
      return isText(layer) ? relayout({ ...layer, content: op.content }, canvas) : layer;

    case "style-text": {
      if (!isText(layer)) return layer;
      const next: TextLayer = {
        ...layer,
        ...(op.fontFamily ? { fontFamily: op.fontFamily } : {}),
        ...(op.fontWeight ? { fontWeight: op.fontWeight } : {}),
        ...(op.lineHeight ? { lineHeight: op.lineHeight } : {}),
        ...(op.letterSpacing !== undefined ? { letterSpacing: op.letterSpacing } : {}),
        ...(op.align ? { align: op.align } : {}),
        ...(op.transform ? { transform: op.transform } : {}),
        ...(op.color ? { color: op.color } : {}),
        ...(op.sizeScale ? { fontSize: layer.fontSize * op.sizeScale } : {}),
      };
      return relayout(next, canvas);
    }

    case "move":
      return { ...layer, x: layer.x + op.dx * canvas.width, y: layer.y + op.dy * canvas.height };

    case "place": {
      const box = { x: canvas.margin, y: canvas.margin, width: canvas.width - canvas.margin * 2, height: canvas.height - canvas.margin * 2 };
      const [vertical, horizontal] = op.position.split("-") as [string, string];
      const x =
        horizontal === "left" ? box.x : horizontal === "right" ? box.x + box.width - layer.width : box.x + (box.width - layer.width) / 2;
      const y =
        vertical === "top" ? box.y : vertical === "bottom" ? box.y + box.height - layer.height : box.y + (box.height - layer.height) / 2;
      return { ...layer, x, y };
    }

    case "scale": {
      const width = layer.width * op.factor;
      const height = layer.height * op.factor;
      const scaled = {
        ...layer,
        width,
        height,
        x: layer.x - (width - layer.width) / 2,
        y: layer.y - (height - layer.height) / 2,
      };
      return isText(scaled) ? relayout({ ...scaled, fontSize: scaled.fontSize * op.factor }, canvas) : scaled;
    }

    case "set-treatment":
      return layer.type === "image" ? { ...layer, treatments: op.treatments } : layer;

    case "reorder": {
      const delta = op.to === "front" ? 1000 : op.to === "back" ? -1000 : op.to === "forward" ? 1.5 : -1.5;
      return { ...layer, zIndex: layer.zIndex + delta };
    }

    case "set-visibility":
      return { ...layer, visible: op.visible };

    case "delete":
      return { ...layer, visible: false };

    default:
      return layer;
  }
}

/** Re-measure a text layer after any change that affects its lines. */
export function relayout(layer: TextLayer, canvas: Canvas): TextLayer {
  const result = layoutText({
    content: layer.content,
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    italic: layer.fontStyle === "italic",
    fontSize: layer.fontSize,
    minFontSize: minimumFontSize(canvas),
    lineHeight: layer.lineHeight,
    letterSpacing: layer.letterSpacing,
    maxWidth: layer.width,
    maxLines: MAX_LINES[layer.slot] ?? Math.max(2, layer.maxLines),
    transform: layer.transform,
    fit: layer.fit,
    balance: layer.slot === "headline" || layer.slot === "subheadline",
  });
  return {
    ...layer,
    fontSize: result.fontSize,
    height: result.height,
    lines: result.lines,
    overflow: result.overflow,
    maxLines: MAX_LINES[layer.slot] ?? Math.max(2, layer.maxLines),
  };
}

function resolveTarget(doc: DesignDocument, target: PatchTarget): Layer | undefined {
  if ("layerId" in target) return doc.layers.find((l) => l.id === target.layerId);
  return doc.layers.find((l) => l.slot === target.slot);
}

// ---------------------------------------------------- deterministic fallback

const SLOT_WORDS: Array<[RegExp, SlotRole]> = [
  [/\b(headline|title|event name|heading)\b/i, "headline"],
  [/\b(subtitle|subheadline|speaker|preacher|minister)\b/i, "subheadline"],
  [/\b(date)\b/i, "date"],
  [/\b(time|hour)\b/i, "time"],
  [/\b(location|venue|address)\b/i, "location"],
  [/\b(logo|brand mark)\b/i, "logo"],
  [/\b(cta|call to action|button)\b/i, "cta"],
  [/\b(footer|website|handles?|socials?)\b/i, "footer"],
  [/\b(photo|portrait|pastor|person|subject|image)\b/i, "subject"],
  [/\b(eyebrow|church name|series)\b/i, "eyebrow"],
];

/**
 * A small, honest rule engine so natural-language editing works with no API key.
 * It handles the requests users actually type; anything else asks for a rephrase.
 */
export function heuristicPatch(doc: DesignDocument, instruction: string): DesignPatch {
  const text = instruction.toLowerCase();
  const slot = SLOT_WORDS.find(([pattern]) => pattern.test(text))?.[1];
  const ops: DesignPatchOp[] = [];

  if (/\b(bigger|larger|increase|grow|bolder)\b/.test(text) && slot) {
    ops.push({ op: "style-text", target: { slot }, sizeScale: 1.25 });
  } else if (/\b(smaller|reduce|shrink|decrease)\b/.test(text) && slot) {
    ops.push({ op: "style-text", target: { slot }, sizeScale: 0.8 });
  }

  if (/\bdarker\b/.test(text) && /background/.test(text)) {
    ops.push({ op: "set-palette", background: darken(doc.palette.background, 0.35) });
  } else if (/\blighter\b/.test(text) && /background/.test(text)) {
    ops.push({ op: "set-palette", background: lighten(doc.palette.background, 0.35) });
  }

  const direction = /\b(left|right|up|down)\b/.exec(text)?.[1];
  if (direction && slot && /\bmove|nudge|shift\b/.test(text)) {
    const step = /\bslightly|a little|a bit\b/.test(text) ? 0.03 : 0.08;
    ops.push({
      op: "move",
      target: { slot },
      dx: direction === "left" ? -step : direction === "right" ? step : 0,
      dy: direction === "up" ? -step : direction === "down" ? step : 0,
    });
  }

  if (/\b(top|bottom)\b/.test(text) && slot && /\bput|place|move\b/.test(text)) {
    const vertical = /\btop\b/.test(text) ? "top" : "bottom";
    const horizontal = /\bleft\b/.test(text) ? "left" : /\bright\b/.test(text) ? "right" : "center";
    ops.push({ op: "place", target: { slot }, position: `${vertical}-${horizontal}` as never });
  }

  if (/\bmore minimal|less clutter|reduce the clutter|simpler\b/.test(text)) {
    ops.push({ op: "recompose", spacing: "generous", density: "airy" });
  } else if (/\bmore (energetic|youthful|dynamic)\b/.test(text)) {
    ops.push({ op: "recompose", spacing: "tight", scaleContrast: 4, density: "dense" });
  } else if (/\bmore premium|more elegant|more expensive\b/.test(text)) {
    ops.push({ op: "recompose", spacing: "generous", scaleContrast: 3 });
  } else if (/\b(another|different|new) composition|recompose|try another layout\b/.test(text)) {
    ops.push({ op: "recompose" });
  }

  if (/\bnot visible enough|hard to (see|read)|doesn'?t stand out|pop\b/.test(text) && slot) {
    ops.push({ op: "style-text", target: { slot }, sizeScale: 1.2, color: doc.palette.accent });
  }

  if (ops.length === 0) {
    return {
      summary: "No change — request not understood",
      ops: [{ op: "recompose" }],
    };
  }

  return { summary: instruction.slice(0, 110), ops: ops.slice(0, 6) };
}
