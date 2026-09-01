import { newId } from "@gdp/core";
import type { BackgroundPlan, Canvas, Layer, Paint } from "@gdp/design-schema";

export interface BackgroundResult {
  paint: Paint;
  layers: Layer[];
  /** Approximate colour sitting behind the text stack — drives contrast repair. */
  effectiveColor: string;
}

/**
 * Backgrounds are painted, not generated. A "photo" background is the user's
 * own upload with a deterministic scrim, so nothing about it is hallucinated.
 */
export function buildBackground(
  plan: BackgroundPlan,
  canvas: Canvas,
  assetIdFor: (ref: string) => string | undefined,
): BackgroundResult {
  switch (plan.type) {
    case "solid":
      return {
        paint: { type: "solid", color: plan.color, opacity: 1 },
        layers: [],
        effectiveColor: plan.color,
      };

    case "gradient":
      return {
        paint: {
          type: "linear-gradient",
          angle: plan.angle,
          stops: [
            { offset: 0, color: plan.from, opacity: 1 },
            { offset: 1, color: plan.to, opacity: 1 },
          ],
        },
        layers: [],
        effectiveColor: plan.to,
      };

    case "texture":
      return {
        paint: { type: "solid", color: plan.baseColor, opacity: 1 },
        layers: [
          {
            type: "texture",
            id: "background_texture",
            name: `${plan.texture} texture`,
            slot: "texture",
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
            rotation: 0,
            opacity: 1,
            zIndex: 1,
            visible: true,
            locked: false,
            blendMode: "normal",
            texture: plan.texture,
            color: plan.color,
            baseColor: plan.baseColor,
            intensity: plan.intensity,
            scale: 1,
            seed: 7,
          },
        ],
        effectiveColor: plan.baseColor,
      };

    case "photo": {
      const assetId = assetIdFor(plan.assetRef);
      const layers: Layer[] = [];
      if (assetId) {
        layers.push({
          type: "image",
          id: "background_photo",
          name: "Background photo",
          slot: "background",
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
          rotation: 0,
          opacity: 1,
          zIndex: 1,
          visible: true,
          locked: false,
          blendMode: "normal",
          assetId,
          maskAssetId: null,
          crop: { x: 0, y: 0, width: 1, height: 1 },
          fit: "cover",
          focalX: 0.5,
          focalY: 0.4,
          treatments: plan.blur > 0 ? [{ type: "blur", radius: plan.blur }] : [],
          adjustments: { brightness: 0, contrast: 0, saturation: 0, exposure: 0 },
          cornerRadius: 0,
          immutable: false,
        });
      }
      if (plan.darken > 0) {
        layers.push({
          type: "shape",
          id: "background_scrim",
          name: "Scrim",
          slot: "overlay",
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
          rotation: 0,
          opacity: plan.darken,
          zIndex: 2,
          visible: true,
          locked: false,
          blendMode: "normal",
          shape: "rect",
          fill: { type: "solid", color: "#000000", opacity: 1 },
          cornerRadius: 0,
          sides: 6,
        });
      }
      return {
        paint: { type: "solid", color: "#000000", opacity: 1 },
        layers,
        effectiveColor: plan.darken >= 0.35 ? "#141414" : "#5a5a5a",
      };
    }

    default:
      return {
        paint: { type: "solid", color: "#0b0b0f", opacity: 1 },
        layers: [],
        effectiveColor: "#0b0b0f",
      };
  }
}

export function newLayerId(prefix: string): string {
  return `${prefix}_${newId("layer").slice(-6)}`;
}
