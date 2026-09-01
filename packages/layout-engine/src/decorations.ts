import type { Rect } from "@gdp/core";
import type { Canvas, DecorationPlan, Layer, Palette } from "@gdp/design-schema";

/**
 * Decorations are recipes, not free-form drawing. Each one is a small, tasteful
 * geometric gesture that a designer would actually use — the planner picks the
 * gesture, the engine draws it correctly.
 */
export function buildDecorations(
  plans: DecorationPlan[],
  canvas: Canvas,
  palette: Palette,
  regions: { textStack: Rect; footer: Rect; align?: "left" | "center" | "right" },
  zIndexStart: number,
): Layer[] {
  const layers: Layer[] = [];
  let z = zIndexStart;

  plans.forEach((plan, index) => {
    const color = colorOf(palette, plan.colorRole);
    const id = `decoration_${index + 1}`;
    const unit = Math.min(canvas.width, canvas.height);

    switch (plan.kind) {
      case "accent-bar": {
        const barWidth = unit * (0.06 + plan.intensity * 0.12);
        const barX =
          regions.align === "center"
            ? regions.textStack.x + (regions.textStack.width - barWidth) / 2
            : regions.align === "right"
              ? regions.textStack.x + regions.textStack.width - barWidth
              : regions.textStack.x;
        layers.push({
          type: "shape",
          id,
          name: "Accent bar",
          slot: "decoration",
          x: barX,
          y: regions.textStack.y - unit * 0.045,
          width: barWidth,
          height: Math.max(4, unit * 0.008),
          rotation: 0,
          opacity: 1,
          zIndex: z++,
          visible: true,
          locked: false,
          blendMode: "normal",
          shape: "rect",
          fill: { type: "solid", color, opacity: 1 },
          cornerRadius: 0,
          sides: 6,
        });
        break;
      }

      case "diagonal-slash":
        layers.push({
          type: "shape",
          id,
          name: "Diagonal",
          slot: "decoration",
          x: -canvas.width * 0.1,
          y: canvas.height * 0.62,
          width: canvas.width * 1.2,
          height: Math.max(3, unit * 0.004),
          rotation: -14,
          opacity: 0.5 + plan.intensity * 0.5,
          zIndex: z++,
          visible: true,
          locked: false,
          blendMode: "normal",
          shape: "rect",
          fill: { type: "solid", color, opacity: 1 },
          cornerRadius: 0,
          sides: 6,
        });
        break;

      case "circle-badge":
        layers.push({
          type: "shape",
          id,
          name: "Badge",
          slot: "decoration",
          x: canvas.width - unit * 0.28,
          y: canvas.height * 0.06,
          width: unit * 0.2,
          height: unit * 0.2,
          rotation: 0,
          opacity: 0.9,
          zIndex: z++,
          visible: true,
          locked: false,
          blendMode: "normal",
          shape: "ellipse",
          fill: { type: "solid", color, opacity: 1 },
          cornerRadius: 0,
          sides: 6,
        });
        break;

      case "corner-brackets": {
        const size = unit * 0.09;
        const thickness = Math.max(3, unit * 0.005);
        const m = canvas.margin * 0.6;
        const corners: Array<[number, number, number, number]> = [
          [m, m, size, thickness],
          [m, m, thickness, size],
          [canvas.width - m - size, canvas.height - m - thickness, size, thickness],
          [canvas.width - m - thickness, canvas.height - m - size, thickness, size],
        ];
        corners.forEach((c, i) => {
          layers.push({
            type: "shape",
            id: `${id}_${i}`,
            name: "Bracket",
            slot: "decoration",
            x: c[0],
            y: c[1],
            width: c[2],
            height: c[3],
            rotation: 0,
            opacity: 0.5 + plan.intensity * 0.5,
            zIndex: z,
            visible: true,
            locked: false,
            blendMode: "normal",
            shape: "rect",
            fill: { type: "solid", color, opacity: 1 },
            cornerRadius: 0,
            sides: 6,
          });
        });
        z += 1;
        break;
      }

      case "grid-lines":
      case "dotted-field":
        layers.push({
          type: "texture",
          id,
          name: plan.kind,
          slot: "decoration",
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
          rotation: 0,
          opacity: 0.25 + plan.intensity * 0.35,
          zIndex: z++,
          visible: true,
          locked: false,
          blendMode: "normal",
          texture: plan.kind === "grid-lines" ? "grid" : "dots",
          color,
          intensity: plan.intensity,
          scale: 1,
          seed: 11,
        });
        break;

      case "arc":
        layers.push({
          type: "shape",
          id,
          name: "Arc",
          slot: "decoration",
          x: canvas.width * 0.5 - unit * 0.45,
          y: canvas.height * 0.28,
          width: unit * 0.9,
          height: unit * 0.9,
          rotation: 0,
          opacity: 0.35 + plan.intensity * 0.4,
          zIndex: z++,
          visible: true,
          locked: false,
          blendMode: "normal",
          shape: "ellipse",
          stroke: { color, width: Math.max(2, unit * 0.004), align: "center" },
          cornerRadius: 0,
          sides: 6,
        });
        break;

      case "none":
      default:
        break;
    }
  });

  return layers;
}

function colorOf(palette: Palette, role: DecorationPlan["colorRole"]): string {
  switch (role) {
    case "accent":
      return palette.accent;
    case "accentAlt":
      return palette.accentAlt ?? palette.accent;
    case "ink":
      return palette.ink;
    case "inkMuted":
      return palette.inkMuted;
    case "surface":
      return palette.surface;
    default:
      return palette.accent;
  }
}
