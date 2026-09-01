import type { Paint } from "@gdp/design-schema";
import { attrs, DefsBuilder, round } from "./xml.js";

/** Split #rrggbbaa into a colour and an alpha the SVG attributes can use. */
export function splitAlpha(hex: string): { color: string; alpha: number } {
  if (hex.length === 9) {
    return { color: hex.slice(0, 7), alpha: Number.parseInt(hex.slice(7, 9), 16) / 255 };
  }
  return { color: hex, alpha: 1 };
}

export interface PaintRef {
  fill: string;
  opacity: number;
}

export function resolvePaint(
  paint: Paint | undefined,
  defs: DefsBuilder,
  box: { x: number; y: number; width: number; height: number },
): PaintRef {
  if (!paint) return { fill: "none", opacity: 1 };

  switch (paint.type) {
    case "solid": {
      const { color, alpha } = splitAlpha(paint.color);
      return { fill: color, opacity: alpha * paint.opacity };
    }
    case "linear-gradient": {
      const id = defs.nextId("lg");
      const rad = ((paint.angle - 90) * Math.PI) / 180;
      const x1 = 0.5 - Math.cos(rad) / 2;
      const y1 = 0.5 - Math.sin(rad) / 2;
      const x2 = 0.5 + Math.cos(rad) / 2;
      const y2 = 0.5 + Math.sin(rad) / 2;
      const stops = paint.stops
        .map((s) => {
          const { color, alpha } = splitAlpha(s.color);
          return `<stop ${attrs({ offset: round(s.offset), "stop-color": color, "stop-opacity": round(alpha * s.opacity) })}/>`;
        })
        .join("");
      defs.add(
        `<linearGradient id="${id}" ${attrs({ x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2) })}>${stops}</linearGradient>`,
      );
      return { fill: `url(#${id})`, opacity: 1 };
    }
    case "radial-gradient": {
      const id = defs.nextId("rg");
      const stops = paint.stops
        .map((s) => {
          const { color, alpha } = splitAlpha(s.color);
          return `<stop ${attrs({ offset: round(s.offset), "stop-color": color, "stop-opacity": round(alpha * s.opacity) })}/>`;
        })
        .join("");
      defs.add(
        `<radialGradient id="${id}" ${attrs({ cx: round(paint.cx), cy: round(paint.cy), r: round(paint.radius) })}>${stops}</radialGradient>`,
      );
      return { fill: `url(#${id})`, opacity: 1 };
    }
    case "image": {
      const id = defs.nextId("ip");
      defs.add(
        `<pattern id="${id}" ${attrs({ patternUnits: "userSpaceOnUse", x: box.x, y: box.y, width: box.width, height: box.height })}></pattern>`,
      );
      return { fill: `url(#${id})`, opacity: paint.opacity };
    }
    default:
      return { fill: "none", opacity: 1 };
  }
}
