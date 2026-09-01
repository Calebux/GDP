import { createLogger, env, newId } from "@gdp/core";
import type { Canvas, DesignBrief, DesignConceptPlan, DesignDocument, Repair } from "@gdp/design-schema";
import { type DesignDna, type StyleDirection, computeDna, dnaDistance, resolveDirection } from "@gdp/design-dna";
import { composeDocument, type AssetRefInfo } from "@gdp/layout-engine";
import { type AssetFacts, type VqsReport, evaluate } from "@gdp/qa";
import { heuristicConcepts, type AssetSummary } from "./heuristic.js";
import { planConcepts } from "./plan.js";

const log = createLogger("planner:generate");

export interface GenerateInput {
  designId?: string;
  brief: DesignBrief;
  canvas: Canvas;
  assets: AssetRefInfo[];
  /** Digested reference principles from retrieval (§12). */
  references?: string[];
  referenceIds?: string[];
  direction?: StyleDirection;
  candidateCount?: number;
  conceptsShown?: number;
  qaAssets?: Record<string, AssetFacts>;
  threshold?: number;
  seed?: number;
}

export interface Candidate {
  id: string;
  plan: DesignConceptPlan;
  doc: DesignDocument;
  report: VqsReport;
  dna: DesignDna;
  repairs: Repair[];
}

export interface GenerateResult {
  concepts: Candidate[];
  /** Everything that was generated and scored, strongest first. */
  considered: Candidate[];
  rejected: number;
  usedModel: boolean;
  direction: string;
  durationMs: number;
}

function summarise(assets: AssetRefInfo[]): AssetSummary[] {
  return assets.map((a) => ({
    ref: a.ref,
    kind: a.kind,
    ...(a.analysis?.facing ? { facing: a.analysis.facing } : {}),
  }));
}

/**
 * §42 — Generator → Critic → Ranker → User.
 * Many candidates are composed and scored internally; only the strongest,
 * meaningfully different ones are ever shown.
 */
export async function generateConcepts(input: GenerateInput): Promise<GenerateResult> {
  const started = Date.now();
  const config = safeConfig();
  const candidateCount = input.candidateCount ?? config.candidates;
  const shown = input.conceptsShown ?? config.shown;
  const direction = input.direction ?? resolveDirection(input.brief.styleDirection, input.brief.feeling);
  const summaries = summarise(input.assets);

  const planned = await planConcepts({
    brief: input.brief,
    canvas: input.canvas,
    assets: summaries,
    references: input.references ?? [],
    direction,
    conceptCount: Math.min(4, candidateCount),
    seed: input.seed,
  });

  // Expand the planner's ideas into a wider candidate pool of valid variants.
  const variants = heuristicConcepts({
    brief: input.brief,
    assets: summaries,
    direction,
    canvas: input.canvas,
    count: Math.max(0, candidateCount - planned.concepts.length),
    seed: (input.seed ?? 1) + 977,
  });

  const plans = [...planned.concepts, ...variants].slice(0, candidateCount);
  const baseId = input.designId ?? newId("des");

  const candidates: Candidate[] = plans.map((plan, index) => {
    const { doc, repairs } = composeDocument({
      id: `${baseId}_c${index + 1}`,
      canvas: input.canvas,
      plan,
      assets: input.assets,
      meta: {
        title: input.brief.eventTitle || plan.conceptName,
        category: input.brief.category,
        subcategory: input.brief.subcategory,
        styleDirection: direction.id,
        referenceIds: input.referenceIds ?? [],
        plannerModel: planned.model ?? "deterministic",
      },
    });
    const report = evaluate(doc, {
      ...(input.qaAssets ? { assets: input.qaAssets } : {}),
      ...(input.threshold !== undefined ? { threshold: input.threshold } : {}),
    });
    return { id: doc.id, plan, doc, report, dna: computeDna(doc), repairs };
  });

  const ranked = [...candidates].sort((a, b) => b.report.total - a.report.total);
  const distinct = dedupe(ranked, 0.09);
  const passing = distinct.filter((c) => c.report.passed);

  // §21 — never show a design below the bar. If nothing clears it, show the
  // strongest anyway but say so, rather than silently shipping poor work.
  const concepts = (passing.length >= shown ? passing : distinct).slice(0, shown);

  log.info("generated concepts", {
    candidates: candidates.length,
    passing: passing.length,
    shown: concepts.length,
    best: ranked[0]?.report.total,
  });

  return {
    concepts,
    considered: ranked,
    rejected: candidates.length - concepts.length,
    usedModel: planned.usedModel,
    direction: direction.id,
    durationMs: Date.now() - started,
  };
}

/** Three concepts that differ only in accent colour are one concept (§20). */
function dedupe(ranked: Candidate[], minDistance: number): Candidate[] {
  const kept: Candidate[] = [];
  for (const candidate of ranked) {
    // Compare the *composed* archetype: two plans that mirror to the same
    // layout after subject-facing orientation are the same concept.
    const tooSimilar = kept.some(
      (k) =>
        k.doc.meta.composition === candidate.doc.meta.composition &&
        dnaDistance(k.dna, candidate.dna) < minDistance,
    );
    if (!tooSimilar) kept.push(candidate);
  }
  return kept;
}

function safeConfig(): { candidates: number; shown: number } {
  try {
    const e = env();
    return { candidates: e.CANDIDATES_PER_GENERATION, shown: e.CONCEPTS_SHOWN };
  } catch {
    return { candidates: 10, shown: 3 };
  }
}
