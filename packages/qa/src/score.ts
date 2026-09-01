import { env } from "@gdp/core";
import type { DesignDocument } from "@gdp/design-schema";
import {
  checkAssetIntegrity,
  checkComposition,
  checkContrast,
  checkHierarchy,
  checkSpacing,
  checkStyleCoherence,
  checkTechnical,
  checkTypography,
} from "./checks.js";
import type { QaContext, QaIssue, VqsReport } from "./types.js";

/**
 * §21 / §57 / §66 — the quality gate. The user is never the QA department:
 * a design that scores below the threshold is not shown, it is recomposed.
 */
export function evaluate(doc: DesignDocument, ctx: QaContext = {}): VqsReport {
  const components = [
    checkTypography(doc),
    checkComposition(doc),
    checkHierarchy(doc),
    checkSpacing(doc),
    checkContrast(doc, ctx),
    checkAssetIntegrity(doc, ctx),
    checkStyleCoherence(doc),
    checkTechnical(doc, ctx),
  ];

  const total = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  const issues = components.flatMap((c) => c.issues).sort((a, b) => b.penalty - a.penalty);
  const threshold = ctx.threshold ?? safeThreshold();

  return {
    total: Math.round(total * 10) / 10,
    passed: total >= threshold && !issues.some((i) => i.severity === "error"),
    threshold,
    components,
    issues,
    summary: summarise(components, issues, total),
  };
}

function safeThreshold(): number {
  try {
    return env().VQS_THRESHOLD;
  } catch {
    return 82;
  }
}

function summarise(
  components: ReturnType<typeof checkTypography>[],
  issues: QaIssue[],
  total: number,
): string[] {
  const lines = [`Visual Quality Score ${Math.round(total)}/100`];
  const weakest = [...components].sort((a, b) => a.score - b.score)[0];
  if (weakest && weakest.score < 90) {
    lines.push(`Weakest area: ${weakest.name} (${Math.round(weakest.score)}/100)`);
  }
  for (const issue of issues.slice(0, 4)) {
    lines.push(`${issue.severity === "error" ? "✗" : "!"} ${issue.message}`);
  }
  return lines;
}

/** Rank candidates highest-score-first (§42 Generator → Critic → Ranker → User). */
export function rank<T extends { doc: DesignDocument }>(
  candidates: T[],
  ctx: QaContext = {},
): Array<T & { report: VqsReport }> {
  return candidates
    .map((candidate) => ({ ...candidate, report: evaluate(candidate.doc, ctx) }))
    .sort((a, b) => b.report.total - a.report.total);
}
