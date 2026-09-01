import type { TextureLayer } from "@gdp/design-schema";
import { attrs, DefsBuilder, round } from "./xml.js";
import { splitAlpha } from "./paint.js";

/**
 * Procedural textures (§34). Everything here is drawn from a seed, so a design
 * renders identically every time and costs nothing to produce.
 */
export function renderTexture(layer: TextureLayer, defs: DefsBuilder): string {
  const { color } = splitAlpha(layer.color);
  const w = layer.width;
  const h = layer.height;
  const unit = Math.min(w, h);
  const box = attrs({ x: layer.x, y: layer.y, width: w, height: h });

  switch (layer.texture) {
    case "grain":
    case "noise-gradient": {
      const id = defs.nextId("tex");
      defs.add(
        `<filter id="${id}" ${attrs({ x: "0%", y: "0%", width: "100%", height: "100%", "color-interpolation-filters": "sRGB" })}><feTurbulence type="fractalNoise" baseFrequency="${
          layer.texture === "grain" ? 0.9 : 0.012
        }" numOctaves="${layer.texture === "grain" ? 3 : 2}" seed="${layer.seed}" result="n"/><feColorMatrix in="n" type="saturate" values="0"/></filter>`,
      );
      return `<rect ${box} filter="url(#${id})" opacity="${round(layer.intensity * layer.opacity)}"/>`;
    }

    case "dots":
    case "halftone": {
      const id = defs.nextId("pat");
      const size = Math.max(6, unit * 0.02 * layer.scale);
      const r = size * (layer.texture === "halftone" ? 0.28 : 0.12);
      defs.add(
        `<pattern id="${id}" ${attrs({ patternUnits: "userSpaceOnUse", width: round(size), height: round(size) })}><circle ${attrs(
          { cx: round(size / 2), cy: round(size / 2), r: round(r), fill: color },
        )}/></pattern>`,
      );
      return `<rect ${box} fill="url(#${id})" opacity="${round(layer.intensity * layer.opacity)}"/>`;
    }

    case "grid": {
      const id = defs.nextId("pat");
      const size = Math.max(24, unit * 0.06 * layer.scale);
      const stroke = Math.max(1, unit * 0.0012);
      defs.add(
        `<pattern id="${id}" ${attrs({ patternUnits: "userSpaceOnUse", width: round(size), height: round(size) })}><path ${attrs(
          {
            d: `M ${round(size)} 0 L 0 0 0 ${round(size)}`,
            fill: "none",
            stroke: color,
            "stroke-width": round(stroke),
          },
        )}/></pattern>`,
      );
      return `<rect ${box} fill="url(#${id})" opacity="${round(layer.intensity * layer.opacity)}"/>`;
    }

    case "mesh": {
      const id = defs.nextId("rg");
      defs.add(
        `<radialGradient id="${id}" cx="0.3" cy="0.25" r="0.8"><stop offset="0" stop-color="${color}" stop-opacity="${round(
          layer.intensity,
        )}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
      );
      const id2 = defs.nextId("rg");
      defs.add(
        `<radialGradient id="${id2}" cx="0.8" cy="0.75" r="0.7"><stop offset="0" stop-color="${color}" stop-opacity="${round(
          layer.intensity * 0.8,
        )}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
      );
      return `<g opacity="${round(layer.opacity)}"><rect ${box} fill="url(#${id})"/><rect ${box} fill="url(#${id2})"/></g>`;
    }

    case "rays": {
      const count = 12;
      const cx = layer.x + w / 2;
      const cy = layer.y + h * 0.15;
      const length = Math.hypot(w, h);
      const rays = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const spread = (Math.PI * 2) / count / 3;
        const p1 = `${round(cx + Math.cos(angle - spread) * length)},${round(cy + Math.sin(angle - spread) * length)}`;
        const p2 = `${round(cx + Math.cos(angle + spread) * length)},${round(cy + Math.sin(angle + spread) * length)}`;
        return `<polygon points="${round(cx)},${round(cy)} ${p1} ${p2}" fill="${color}"/>`;
      }).join("");
      return `<g opacity="${round(layer.intensity * layer.opacity * 0.5)}" clip-path="url(#${clipFor(layer, defs)})">${rays}</g>`;
    }

    case "topography": {
      const rings = 9;
      const cx = layer.x + w * 0.5;
      const cy = layer.y + h * 0.5;
      const stroke = Math.max(1, unit * 0.0015);
      const paths = Array.from({ length: rings }, (_, i) => {
        const rx = (unit * 0.12 + i * unit * 0.075) * layer.scale;
        const ry = rx * 0.72;
        return `<ellipse ${attrs({ cx: round(cx), cy: round(cy), rx: round(rx), ry: round(ry), fill: "none", stroke: color, "stroke-width": round(stroke) })}/>`;
      }).join("");
      return `<g opacity="${round(layer.intensity * layer.opacity)}" clip-path="url(#${clipFor(layer, defs)})">${paths}</g>`;
    }

    default:
      return "";
  }
}

function clipFor(layer: TextureLayer, defs: DefsBuilder): string {
  const id = defs.nextId("clip");
  defs.add(
    `<clipPath id="${id}"><rect ${attrs({ x: layer.x, y: layer.y, width: layer.width, height: layer.height })}/></clipPath>`,
  );
  return id;
}
