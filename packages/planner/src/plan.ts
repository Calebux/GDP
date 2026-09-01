import { z } from "zod";
import { createLogger } from "@gdp/core";
import {
  type Canvas,
  type DesignBrief,
  type DesignConceptPlan,
  DesignPlan,
} from "@gdp/design-schema";
import { type StyleDirection, resolveDirection } from "@gdp/design-dna";
import { heuristicConcepts, type AssetSummary } from "./heuristic.js";
import { plannerSystemPrompt, plannerUserPrompt } from "./prompts.js";
import { structuredOrFallback } from "./llm.js";

const log = createLogger("planner");

export interface PlanInput {
  brief: DesignBrief;
  canvas: Canvas;
  assets: AssetSummary[];
  /** Digested reference principles from retrieval (§12). */
  references?: string[];
  direction?: StyleDirection;
  conceptCount?: number;
  seed?: number;
}

export interface PlanResult {
  concepts: DesignConceptPlan[];
  usedModel: boolean;
  model?: string;
  direction: StyleDirection;
}

function briefText(brief: DesignBrief): string {
  const rows: Array<[string, string]> = [
    ["type", `${brief.category} / ${brief.subcategory}`],
    ["event title", brief.eventTitle],
    ["series", brief.seriesName],
    ["organisation", brief.organisationName],
    ["date", brief.date],
    ["time", brief.time],
    ["location", brief.location],
    ["people", brief.people.map((p) => `${p.title} ${p.name}`.trim()).join(", ")],
    ["call to action", brief.callToAction],
    ["website", brief.website],
    ["socials", brief.socials],
    ["extra lines", brief.extraLines.join(" | ")],
    ["feeling", brief.feeling],
  ];
  return rows
    .filter(([, value]) => value && value.length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function assetText(assets: AssetSummary[]): string {
  if (assets.length === 0) return "none uploaded — the design must work typographically";
  return assets
    .map((a) => `${a.ref} (${a.kind}${a.facing && a.facing !== "unknown" ? `, facing ${a.facing}` : ""})`)
    .join("\n");
}

/**
 * §14 — the design planner. With a model configured it reasons over the brief,
 * assets and retrieved principles; without one it falls back to the curated
 * deterministic planner, which is also what generates the candidate variants.
 */
export async function planConcepts(input: PlanInput): Promise<PlanResult> {
  const direction = input.direction ?? resolveDirection(input.brief.styleDirection, input.brief.feeling);
  const count = input.conceptCount ?? 3;

  const fallback = (): { concepts: DesignConceptPlan[] } => ({
    concepts: heuristicConcepts({
      brief: input.brief,
      assets: input.assets,
      direction,
      count,
      canvas: input.canvas,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    }),
  });

  const { value, usedModel, model } = await structuredOrFallback(
    {
      task: "planner",
      system: plannerSystemPrompt(),
      prompt: plannerUserPrompt({
        briefText: briefText(input.brief),
        assetSummary: assetText(input.assets),
        referenceDigests: input.references ?? [],
        directionId: `${direction.id} — ${direction.description}`,
        canvasText: `${input.canvas.width}×${input.canvas.height} (${input.canvas.format})`,
        conceptCount: count,
      }),
      schema: DesignPlan as unknown as z.ZodType<{ concepts: DesignConceptPlan[] }>,
      maxTokens: 8000,
      temperature: 0.8,
      toolName: "emit_design_concepts",
    },
    fallback,
  );

  log.info("planned concepts", { count: value.concepts.length, usedModel, direction: direction.id });
  return { concepts: value.concepts, usedModel, model, direction };
}
