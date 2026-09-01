import { parseHex } from "@gdp/core";
import type { Adjustments, ImageTreatment, Shadow } from "@gdp/design-schema";
import { attrs, DefsBuilder, round } from "./xml.js";
import { splitAlpha } from "./paint.js";

function channelTable(from: string, to: string, channel: "r" | "g" | "b"): string {
  const a = parseHex(from) ?? { r: 0, g: 0, b: 0 };
  const b = parseHex(to) ?? { r: 255, g: 255, b: 255 };
  const start = (channel === "r" ? a.r : channel === "g" ? a.g : a.b) / 255;
  const end = (channel === "r" ? b.r : channel === "g" ? b.g : b.b) / 255;
  return `${round(start)} ${round(end)}`;
}

const LUMINANCE_MATRIX =
  "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";

/**
 * Treatments are SVG filter pipelines. They recolour and stylise, but every
 * pixel still comes from the user's own photograph — nothing is invented (§33).
 */
export function buildTreatmentFilter(
  treatments: ImageTreatment[],
  adjustments: Adjustments,
  defs: DefsBuilder,
): string | null {
  const primitives: string[] = [];
  let source = "SourceGraphic";
  const step = (markup: string, result: string) => {
    primitives.push(markup);
    source = result;
  };

  if (adjustments.brightness !== 0 || adjustments.exposure !== 0) {
    const slope = 1 + adjustments.exposure;
    const intercept = adjustments.brightness * 0.5;
    step(
      `<feComponentTransfer in="${source}" result="adj_b"><feFuncR type="linear" slope="${round(slope)}" intercept="${round(intercept)}"/><feFuncG type="linear" slope="${round(slope)}" intercept="${round(intercept)}"/><feFuncB type="linear" slope="${round(slope)}" intercept="${round(intercept)}"/></feComponentTransfer>`,
      "adj_b",
    );
  }
  if (adjustments.contrast !== 0) {
    const slope = 1 + adjustments.contrast;
    const intercept = (1 - slope) / 2;
    step(
      `<feComponentTransfer in="${source}" result="adj_c"><feFuncR type="linear" slope="${round(slope)}" intercept="${round(intercept)}"/><feFuncG type="linear" slope="${round(slope)}" intercept="${round(intercept)}"/><feFuncB type="linear" slope="${round(slope)}" intercept="${round(intercept)}"/></feComponentTransfer>`,
      "adj_c",
    );
  }
  if (adjustments.saturation !== 0) {
    step(
      `<feColorMatrix in="${source}" type="saturate" values="${round(1 + adjustments.saturation)}" result="adj_s"/>`,
      "adj_s",
    );
  }

  treatments.forEach((treatment, index) => {
    switch (treatment.type) {
      case "monochrome":
        step(
          `<feColorMatrix in="${source}" type="saturate" values="${round(1 - treatment.strength)}" result="t${index}"/>`,
          `t${index}`,
        );
        break;

      case "duotone": {
        primitives.push(
          `<feColorMatrix in="${source}" type="matrix" values="${LUMINANCE_MATRIX}" result="t${index}_l"/>`,
        );
        primitives.push(
          `<feComponentTransfer in="t${index}_l" result="t${index}_d"><feFuncR type="table" tableValues="${channelTable(treatment.shadow, treatment.highlight, "r")}"/><feFuncG type="table" tableValues="${channelTable(treatment.shadow, treatment.highlight, "g")}"/><feFuncB type="table" tableValues="${channelTable(treatment.shadow, treatment.highlight, "b")}"/></feComponentTransfer>`,
        );
        if (treatment.strength >= 1) {
          source = `t${index}_d`;
        } else {
          primitives.push(
            `<feBlend in="t${index}_d" in2="${source}" mode="normal" result="t${index}"/>`,
          );
          source = `t${index}`;
        }
        break;
      }

      case "gradient-map": {
        const first = treatment.stops[0]!;
        const last = treatment.stops[treatment.stops.length - 1]!;
        primitives.push(
          `<feColorMatrix in="${source}" type="matrix" values="${LUMINANCE_MATRIX}" result="t${index}_l"/>`,
        );
        primitives.push(
          `<feComponentTransfer in="t${index}_l" result="t${index}"><feFuncR type="table" tableValues="${channelTable(first.color, last.color, "r")}"/><feFuncG type="table" tableValues="${channelTable(first.color, last.color, "g")}"/><feFuncB type="table" tableValues="${channelTable(first.color, last.color, "b")}"/></feComponentTransfer>`,
        );
        source = `t${index}`;
        break;
      }

      case "blur":
        step(
          `<feGaussianBlur in="${source}" stdDeviation="${round(treatment.radius / 2)}" result="t${index}"/>`,
          `t${index}`,
        );
        break;

      case "grain": {
        primitives.push(
          `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="4" result="t${index}_n"/>`,
        );
        primitives.push(
          `<feColorMatrix in="t${index}_n" type="saturate" values="0" result="t${index}_g"/>`,
        );
        primitives.push(
          `<feComponentTransfer in="t${index}_g" result="t${index}_a"><feFuncA type="linear" slope="${round(treatment.amount)}" intercept="0"/></feComponentTransfer>`,
        );
        primitives.push(
          `<feComposite in="t${index}_a" in2="${source}" operator="in" result="t${index}_m"/>`,
        );
        primitives.push(
          `<feBlend in="t${index}_m" in2="${source}" mode="overlay" result="t${index}"/>`,
        );
        source = `t${index}`;
        break;
      }

      case "rim-light": {
        const { color } = splitAlpha(treatment.color);
        const rad = (treatment.angle * Math.PI) / 180;
        const dx = round(Math.cos(rad) * 8);
        const dy = round(Math.sin(rad) * 8);
        primitives.push(
          `<feOffset in="SourceAlpha" dx="${dx}" dy="${dy}" result="t${index}_o"/>`,
        );
        primitives.push(`<feGaussianBlur in="t${index}_o" stdDeviation="6" result="t${index}_b"/>`);
        primitives.push(`<feFlood flood-color="${color}" flood-opacity="${round(treatment.intensity)}" result="t${index}_f"/>`);
        primitives.push(`<feComposite in="t${index}_f" in2="t${index}_b" operator="in" result="t${index}_r"/>`);
        primitives.push(`<feComposite in="t${index}_r" in2="SourceAlpha" operator="out" result="t${index}_e"/>`);
        primitives.push(
          `<feMerge result="t${index}"><feMergeNode in="t${index}_e"/><feMergeNode in="${source}"/></feMerge>`,
        );
        source = `t${index}`;
        break;
      }

      case "halftone": {
        // Approximation: luminance-driven dot screen, blended over the source.
        primitives.push(
          `<feColorMatrix in="${source}" type="matrix" values="${LUMINANCE_MATRIX}" result="t${index}_l"/>`,
        );
        primitives.push(
          `<feComponentTransfer in="t${index}_l" result="t${index}"><feFuncR type="discrete" tableValues="0 0.25 0.5 0.75 1"/><feFuncG type="discrete" tableValues="0 0.25 0.5 0.75 1"/><feFuncB type="discrete" tableValues="0 0.25 0.5 0.75 1"/></feComponentTransfer>`,
        );
        source = `t${index}`;
        break;
      }

      case "none":
      default:
        break;
    }
  });

  if (primitives.length === 0) return null;
  const id = defs.nextId("flt");
  defs.add(
    `<filter id="${id}" ${attrs({ x: "-25%", y: "-25%", width: "150%", height: "150%", "color-interpolation-filters": "sRGB" })}>${primitives.join("")}</filter>`,
  );
  return id;
}

export function buildShadowFilter(shadow: Shadow, defs: DefsBuilder): string {
  const id = defs.nextId("sh");
  const { color, alpha } = splitAlpha(shadow.color);
  defs.add(
    `<filter id="${id}" ${attrs({ x: "-40%", y: "-40%", width: "180%", height: "180%", "color-interpolation-filters": "sRGB" })}><feDropShadow ${attrs(
      {
        dx: shadow.x,
        dy: shadow.y,
        stdDeviation: shadow.blur / 2,
        "flood-color": color,
        "flood-opacity": round(alpha),
      },
    )}/></filter>`,
  );
  return id;
}
