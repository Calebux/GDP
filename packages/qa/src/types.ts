export type Severity = "error" | "warn" | "info";

export interface QaIssue {
  code: string;
  severity: Severity;
  message: string;
  layerId?: string;
  /** Points removed from the component score, 0–100. */
  penalty: number;
}

export interface ComponentScore {
  name: string;
  weight: number;
  score: number;
  issues: QaIssue[];
}

/** §66 — the Visual Quality Score. */
export interface VqsReport {
  vqsVersion: string;
  total: number;
  passed: boolean;
  threshold: number;
  isBlocking: boolean;
  contentDensityRatio?: number;
  components: ComponentScore[];
  issues: QaIssue[];
  /** Short, human sentences for the designer-facing debug panel. */
  summary: string[];
}

export interface AssetFacts {
  width: number;
  height: number;
  /** Average colour, used to estimate contrast behind text. */
  averageColor?: string;
  kind?: string;
}

export interface QaContext {
  assets?: Record<string, AssetFacts>;
  threshold?: number;
  vqsVersion?: string;
  blockingMode?: boolean;
  experimentalChecks?: boolean;
  /** Formats the design will also be exported to — tightens safe-area checks. */
  targetFormats?: string[];
}

/** §66 weights. */
export const WEIGHTS = {
  typography: 0.2,
  composition: 0.2,
  hierarchy: 0.15,
  spacing: 0.1,
  contrast: 0.1,
  assetIntegrity: 0.1,
  styleCoherence: 0.1,
  technical: 0.05,
} as const;
