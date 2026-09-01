import {
  type DesignDocument,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type TextLayer,
  sortedLayers,
} from "@gdp/design-schema";
import { buildShadowFilter, buildTreatmentFilter } from "./filters.js";
import { resolvePaint, splitAlpha } from "./paint.js";
import { renderTexture } from "./textures.js";
import { attrs, DefsBuilder, escapeXml, round } from "./xml.js";

export interface ResolvedAsset {
  dataUri: string;
  width: number;
  height: number;
}

/** Resolves an asset id to an embeddable data URI. Cutouts return the masked PNG. */
export type AssetResolver = (
  assetId: string,
  opts: { cutout: boolean },
) => Promise<ResolvedAsset | null>;

export interface SvgOptions {
  resolveAsset?: AssetResolver;
  /** Draw margin/safe-area guides — editor preview only, never exported. */
  showGuides?: boolean;
}

export async function documentToSvg(doc: DesignDocument, options: SvgOptions = {}): Promise<string> {
  const defs = new DefsBuilder();
  const { canvas } = doc;
  const body: string[] = [];

  const bg = resolvePaint(canvas.background, defs, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  });
  body.push(
    `<rect ${attrs({ x: 0, y: 0, width: canvas.width, height: canvas.height, fill: bg.fill, "fill-opacity": round(bg.opacity) })}/>`,
  );

  for (const layer of sortedLayers(doc)) {
    if (!layer.visible) continue;
    const markup = await renderLayer(layer, defs, options);
    if (markup) body.push(wrapLayer(layer, markup));
  }

  if (options.showGuides) body.push(renderGuides(doc));

  return [
    `<svg ${attrs({
      xmlns: "http://www.w3.org/2000/svg",
      "xmlns:xlink": "http://www.w3.org/1999/xlink",
      width: canvas.width,
      height: canvas.height,
      viewBox: `0 0 ${canvas.width} ${canvas.height}`,
    })}>`,
    defs.toString(),
    body.join(""),
    "</svg>",
  ].join("");
}

function wrapLayer(layer: Layer, markup: string): string {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const transform = layer.rotation !== 0 ? `rotate(${round(layer.rotation)} ${round(cx)} ${round(cy)})` : undefined;
  const style = layer.blendMode !== "normal" ? `mix-blend-mode:${layer.blendMode}` : undefined;
  const needsGroup = transform || style || layer.opacity < 1;
  if (!needsGroup) return markup;
  return `<g ${attrs({ transform, style, opacity: layer.opacity < 1 ? round(layer.opacity) : undefined })}>${markup}</g>`;
}

async function renderLayer(layer: Layer, defs: DefsBuilder, options: SvgOptions): Promise<string> {
  switch (layer.type) {
    case "text":
      return renderText(layer, defs);
    case "image":
      return renderImage(layer, defs, options);
    case "shape":
      return renderShape(layer, defs);
    case "texture":
      return renderTexture(layer, defs);
    case "group":
      return "";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------- text

function renderText(layer: TextLayer, defs: DefsBuilder): string {
  if (layer.lines.length === 0) return "";
  const { color, alpha } = splitAlpha(layer.color);
  const fill = layer.fill
    ? resolvePaint(layer.fill, defs, layer).fill
    : color;
  const tracking = layer.letterSpacing * layer.fontSize;
  const filter = layer.shadow ? `url(#${buildShadowFilter(layer.shadow, defs)})` : undefined;

  const lines = layer.lines
    .map((line) => {
      if (line.text.length === 0) return "";
      const x =
        layer.align === "center"
          ? layer.x + (layer.width - line.width) / 2
          : layer.align === "right"
            ? layer.x + layer.width - line.width
            : layer.x;
      return `<text ${attrs({
        x: round(x),
        y: round(layer.y + line.baseline),
        "font-family": layer.fontFamily,
        "font-size": round(layer.fontSize),
        "font-weight": layer.fontWeight,
        "font-style": layer.fontStyle === "italic" ? "italic" : undefined,
        "letter-spacing": tracking !== 0 ? round(tracking) : undefined,
        fill,
        "fill-opacity": alpha < 1 ? round(alpha) : undefined,
        stroke: layer.stroke ? splitAlpha(layer.stroke.color).color : undefined,
        "stroke-width": layer.stroke?.width,
        "xml:space": "preserve",
      })}>${escapeXml(line.text)}</text>`;
    })
    .join("");

  return filter ? `<g filter="${filter}">${lines}</g>` : lines;
}

// --------------------------------------------------------------------- image

async function renderImage(
  layer: ImageLayer,
  defs: DefsBuilder,
  options: SvgOptions,
): Promise<string> {
  const asset = options.resolveAsset
    ? await options.resolveAsset(layer.assetId, { cutout: layer.maskAssetId !== null })
    : null;
  if (!asset) return renderPlaceholder(layer, defs);

  const filterId = buildTreatmentFilter(layer.treatments, layer.adjustments, defs);
  const clipId = defs.nextId("clip");
  const radius = Math.min(layer.cornerRadius, Math.min(layer.width, layer.height) / 2);
  defs.add(
    `<clipPath id="${clipId}"><rect ${attrs({
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rx: radius || undefined,
      ry: radius || undefined,
    })}/></clipPath>`,
  );

  const geometry = imageGeometry(layer, asset);
  const image = `<image ${attrs({
    href: asset.dataUri,
    x: round(geometry.x),
    y: round(geometry.y),
    width: round(geometry.width),
    height: round(geometry.height),
    preserveAspectRatio: "none",
    filter: filterId ? `url(#${filterId})` : undefined,
  })}/>`;

  const shadow = layer.shadow ? `url(#${buildShadowFilter(layer.shadow, defs)})` : undefined;
  const clipped = `<g clip-path="url(#${clipId})">${image}</g>`;
  return shadow ? `<g filter="${shadow}">${clipped}</g>` : clipped;
}

/** Cover/contain maths done here so the renderer never relies on viewer defaults. */
function imageGeometry(
  layer: ImageLayer,
  asset: ResolvedAsset,
): { x: number; y: number; width: number; height: number } {
  const sourceAspect = asset.width / Math.max(1, asset.height);
  const boxAspect = layer.width / Math.max(1, layer.height);

  if (layer.fit === "fill") {
    return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  }

  const cover = layer.fit === "cover";
  const scaleByWidth = cover ? sourceAspect < boxAspect : sourceAspect > boxAspect;
  const width = scaleByWidth ? layer.width : layer.height * sourceAspect;
  const height = scaleByWidth ? layer.width / sourceAspect : layer.height;

  return {
    x: layer.x + (layer.width - width) * layer.focalX,
    y: layer.y + (layer.height - height) * layer.focalY,
    width,
    height,
  };
}

function renderPlaceholder(layer: ImageLayer, defs: DefsBuilder): string {
  const id = defs.nextId("ph");
  defs.add(
    `<pattern id="${id}" ${attrs({ patternUnits: "userSpaceOnUse", width: 32, height: 32 })}><rect width="32" height="32" fill="#1b1b22"/><path d="M0 32 L32 0" stroke="#33333d" stroke-width="2"/></pattern>`,
  );
  return `<rect ${attrs({ x: layer.x, y: layer.y, width: layer.width, height: layer.height, fill: `url(#${id})` })}/>`;
}

// --------------------------------------------------------------------- shape

function renderShape(layer: ShapeLayer, defs: DefsBuilder): string {
  const paint = resolvePaint(layer.fill, defs, layer);
  const stroke = layer.stroke
    ? {
        stroke: splitAlpha(layer.stroke.color).color,
        "stroke-width": layer.stroke.width,
        "stroke-dasharray": layer.stroke.dash?.join(" "),
      }
    : {};
  const common = {
    fill: layer.fill ? paint.fill : "none",
    "fill-opacity": layer.fill && paint.opacity < 1 ? round(paint.opacity) : undefined,
    ...stroke,
  };

  switch (layer.shape) {
    case "rect": {
      const radius = Math.min(layer.cornerRadius, Math.min(layer.width, layer.height) / 2);
      return `<rect ${attrs({
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rx: radius || undefined,
        ry: radius || undefined,
        ...common,
      })}/>`;
    }
    case "ellipse":
      return `<ellipse ${attrs({
        cx: layer.x + layer.width / 2,
        cy: layer.y + layer.height / 2,
        rx: layer.width / 2,
        ry: layer.height / 2,
        ...common,
      })}/>`;
    case "line":
      return `<line ${attrs({
        x1: layer.x,
        y1: layer.y + layer.height / 2,
        x2: layer.x + layer.width,
        y2: layer.y + layer.height / 2,
        ...common,
        stroke: common.stroke ?? paint.fill,
        "stroke-width": layer.stroke?.width ?? Math.max(1, layer.height),
      })}/>`;
    case "triangle":
      return `<polygon ${attrs({
        points: `${round(layer.x + layer.width / 2)},${round(layer.y)} ${round(layer.x + layer.width)},${round(
          layer.y + layer.height,
        )} ${round(layer.x)},${round(layer.y + layer.height)}`,
        ...common,
      })}/>`;
    case "polygon": {
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      const points = Array.from({ length: layer.sides }, (_, i) => {
        const angle = (i / layer.sides) * Math.PI * 2 - Math.PI / 2;
        return `${round(cx + (Math.cos(angle) * layer.width) / 2)},${round(cy + (Math.sin(angle) * layer.height) / 2)}`;
      }).join(" ");
      return `<polygon ${attrs({ points, ...common })}/>`;
    }
    case "path":
      return layer.path ? `<path ${attrs({ d: sanitisePath(layer.path), ...common })}/>` : "";
    default:
      return "";
  }
}

/** §64 — the LLM may not smuggle arbitrary markup through a path string. */
function sanitisePath(path: string): string {
  return path.replace(/[^MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]/g, "");
}

function renderGuides(doc: DesignDocument): string {
  const { canvas } = doc;
  const m = canvas.margin;
  return `<g fill="none" stroke="#00e5ff" stroke-width="1" stroke-dasharray="8 8" opacity="0.6"><rect ${attrs(
    { x: m, y: m, width: canvas.width - m * 2, height: canvas.height - m * 2 },
  )}/></g>`;
}
