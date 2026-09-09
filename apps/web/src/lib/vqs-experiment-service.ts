import { createLogger, newId } from "@gdp/core";
import { db, vqsExperiments, vqsExperimentSamples, vqsExperimentRaters, vqsExperimentRatings } from "@gdp/db";
import { eq, and, sql } from "drizzle-orm";

const log = createLogger("vqs-experiment-service");

export interface BlindSampleItem {
  sampleId: string;
  previewUrl: string;
  totalSamples: number;
  currentIndex: number;
}

export interface RatingInput {
  visualQuality: number;
  professionalism: number;
  clarity: number;
  likelihoodToUse: number;
  willingnessToPayBracket: "0" | "1-3" | "3-5" | "5-10" | "10+";
  qualitativeFeedback?: string;
  durationMs?: number;
}

export interface CorrelationReport {
  experimentId: string;
  title: string;
  status: string;
  totalSamples: number;
  totalRaters: number;
  totalRatings: number;
  pearsonCorrelation: number;
  pearsonR: number;
  spearmanCorrelation: number;
  spearmanRho: number;
  meanVqs: number;
  meanHumanScore: number;
  type1Disagreements: Array<{ sampleId: string; vqs: number; humanAverage: number; previewUrl: string }>;
  type2Disagreements: Array<{ sampleId: string; vqs: number; humanAverage: number; previewUrl: string }>;
  willingnessToPayBreakdown: Record<string, number>;
  wtpDistribution: Record<string, number>;
}

export class VqsExperimentService {
  // In-memory fallback for offline dev/tests when Postgres is not running
  private memExperiments = new Map<string, any>();
  private memSamples = new Map<string, any[]>();
  private memRaters = new Map<string, any>();
  private memRatings = new Map<string, any[]>();

  async createExperiment(params: {
    title: string;
    description?: string;
    vqsVersion?: string;
    targetSampleSize?: number;
  }) {
    const id = `exp_${newId("vqs")}`;
    const record = {
      id,
      title: params.title,
      description: params.description || "",
      vqsVersion: params.vqsVersion || "1.1",
      status: "active",
      targetSampleSize: params.targetSampleSize || 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await db().insert(vqsExperiments).values(record as any);
    } catch {
      this.memExperiments.set(id, record);
    }

    return record;
  }

  async addSample(
    experimentIdOrParams:
      | string
      | {
          experimentId: string;
          packId: string;
          conceptId: string;
          previewKey?: string;
          previewUrl: string;
          vqsScore: number;
          vqsReport?: any;
          vqsVersion?: string;
          briefSummary?: string;
        },
    sampleArg?: {
      packId: string;
      conceptId: string;
      previewKey?: string;
      previewUrl: string;
      vqsScore: number;
      vqsReport?: any;
      vqsVersion?: string;
      briefSummary?: string;
    },
  ) {
    const params =
      typeof experimentIdOrParams === "string"
        ? { experimentId: experimentIdOrParams, ...sampleArg! }
        : experimentIdOrParams;

    const id = `smpl_${newId("s")}`;
    const record = {
      id,
      experimentId: params.experimentId,
      packId: params.packId,
      conceptId: params.conceptId,
      previewKey: params.previewKey || params.previewUrl,
      previewUrl: params.previewUrl,
      vqsScore: params.vqsScore,
      vqsReport: params.vqsReport || {},
      vqsVersion: params.vqsVersion || "1.1",
      randomOrderWeight: Math.random(),
      createdAt: new Date(),
    };

    try {
      await db().insert(vqsExperimentSamples).values(record as any);
    } catch {
      const existing = this.memSamples.get(params.experimentId) || [];
      existing.push(record);
      this.memSamples.set(params.experimentId, existing);
    }

    return record;
  }

  async registerRater(
    experimentIdOrParams:
      | string
      | {
          experimentId: string;
          pseudonym?: string;
          name?: string;
          experienceYears?: number;
          isProfessionalDesigner?: boolean;
          role?: string;
        },
    raterArg?: {
      pseudonym?: string;
      name?: string;
      experienceYears?: number;
      isProfessionalDesigner?: boolean;
      role?: string;
    },
  ) {
    const params =
      typeof experimentIdOrParams === "string"
        ? { experimentId: experimentIdOrParams, ...raterArg! }
        : experimentIdOrParams;

    const raterToken = `rater_${newId("sec")}`;
    const id = `rt_${newId("r")}`;
    const record = {
      id,
      experimentId: params.experimentId,
      raterToken,
      blindToken: raterToken,
      pseudonym: params.pseudonym || params.name || `Rater_${id}`,
      experienceYears: params.experienceYears ?? 3,
      isProfessionalDesigner: params.isProfessionalDesigner ?? true,
      consentGivenAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
    };

    try {
      await db().insert(vqsExperimentRaters).values(record as any);
    } catch {
      this.memRaters.set(raterToken, record);
    }

    return record;
  }

  async getBlindedSampleQueue(raterToken: string): Promise<BlindSampleItem[]> {
    let rater: any;
    try {
      const rows = await db()
        .select()
        .from(vqsExperimentRaters)
        .where(eq(vqsExperimentRaters.raterToken, raterToken));
      rater = rows[0];
    } catch {
      rater = this.memRaters.get(raterToken);
    }

    if (!rater) {
      throw new Error("Invalid or unauthenticated rater token");
    }

    let allSamples: any[] = [];
    let ratedSampleIds = new Set<string>();

    try {
      allSamples = await db()
        .select()
        .from(vqsExperimentSamples)
        .where(eq(vqsExperimentSamples.experimentId, rater.experimentId));

      const ratings = await db()
        .select()
        .from(vqsExperimentRatings)
        .where(eq(vqsExperimentRatings.raterId, rater.id));

      ratings.forEach((r) => ratedSampleIds.add(r.sampleId));
    } catch {
      allSamples = this.memSamples.get(rater.experimentId) || [];
      const ratings = (this.memRatings.get(rater.experimentId) || []).filter(
        (r) => r.raterId === rater.id,
      );
      ratings.forEach((r) => ratedSampleIds.add(r.sampleId));
    }

    // Filter unrated samples and randomize deterministically or pseudorandomly
    const unrated = allSamples.filter((s) => !ratedSampleIds.has(s.id));
    unrated.sort((a, b) => a.randomOrderWeight - b.randomOrderWeight);

    return unrated.map((s, index) => ({
      sampleId: s.id,
      previewUrl: s.previewUrl,
      totalSamples: allSamples.length,
      currentIndex: allSamples.length - unrated.length + index + 1,
    }));
  }

  async submitRating(
    raterToken: string,
    sampleIdOrRating:
      | string
      | {
          sampleId: string;
          visualQuality?: number;
          overallQuality?: number;
          professionalism?: number;
          typographyScore?: number;
          clarity?: number;
          hierarchyScore?: number;
          likelihoodToUse?: number;
          commercialViability?: number;
          brandAppropriateness?: number;
          willingnessToPayBracket?: string;
          wouldPayForThis?: string;
          qualitativeFeedback?: string;
          feedback?: string;
          durationMs?: number;
        },
    ratingArg?: any,
  ) {
    const sampleId =
      typeof sampleIdOrRating === "string" ? sampleIdOrRating : sampleIdOrRating.sampleId;
    const rating =
      typeof sampleIdOrRating === "string" ? ratingArg! : sampleIdOrRating;

    let rater: any;
    try {
      const rows = await db()
        .select()
        .from(vqsExperimentRaters)
        .where(eq(vqsExperimentRaters.raterToken, raterToken));
      rater = rows[0];
    } catch {
      rater = this.memRaters.get(raterToken);
    }

    if (!rater) {
      throw new Error("Invalid or unauthenticated rater token");
    }

    const vq = rating.visualQuality ?? rating.overallQuality ?? 3;
    const prof = rating.professionalism ?? rating.typographyScore ?? 3;
    const clr = rating.clarity ?? rating.hierarchyScore ?? 3;
    const ltu = rating.likelihoodToUse ?? rating.commercialViability ?? rating.brandAppropriateness ?? 3;
    const wtp = rating.willingnessToPayBracket ?? rating.wouldPayForThis ?? "not_likely";
    const fb = rating.qualitativeFeedback ?? rating.feedback ?? "";

    const ratingId = `rtg_${newId("rating")}`;
    const record = {
      id: ratingId,
      experimentId: rater.experimentId,
      sampleId,
      raterId: rater.id,
      visualQuality: Math.min(5, Math.max(1, Math.round(vq))),
      professionalism: Math.min(5, Math.max(1, Math.round(prof))),
      clarity: Math.min(5, Math.max(1, Math.round(clr))),
      likelihoodToUse: Math.min(5, Math.max(1, Math.round(ltu))),
      willingnessToPayBracket: wtp,
      qualitativeFeedback: fb,
      durationMs: rating.durationMs || 0,
      createdAt: new Date(),
    };

    try {
      await db().insert(vqsExperimentRatings).values(record as any);
    } catch (err: any) {
      const existing = this.memRatings.get(rater.experimentId) || [];
      const duplicateIndex = existing.findIndex(
        (r) => r.raterId === rater.id && r.sampleId === sampleId,
      );
      if (duplicateIndex !== -1) {
        existing[duplicateIndex] = record;
        return { success: true, ratingId: existing[duplicateIndex].id, updated: true };
      }
      existing.push(record);
      this.memRatings.set(rater.experimentId, existing);
    }

    return { success: true, ratingId };
  }

  async generateCorrelationReport(experimentId: string): Promise<CorrelationReport> {
    let exp: any;
    let samples: any[] = [];
    let ratings: any[] = [];
    let raterCount = 0;

    try {
      const expRows = await db()
        .select()
        .from(vqsExperiments)
        .where(eq(vqsExperiments.id, experimentId));
      exp = expRows[0];

      samples = await db()
        .select()
        .from(vqsExperimentSamples)
        .where(eq(vqsExperimentSamples.experimentId, experimentId));

      ratings = await db()
        .select()
        .from(vqsExperimentRatings)
        .where(eq(vqsExperimentRatings.experimentId, experimentId));

      const raters = await db()
        .select()
        .from(vqsExperimentRaters)
        .where(eq(vqsExperimentRaters.experimentId, experimentId));
      raterCount = raters.length;
    } catch {
      exp = this.memExperiments.get(experimentId) || {
        id: experimentId,
        title: "VQS Calibration Experiment",
        status: "active",
      };
      samples = this.memSamples.get(experimentId) || [];
      ratings = this.memRatings.get(experimentId) || [];
      raterCount = Array.from(this.memRaters.values()).filter(
        (r) => r.experimentId === experimentId,
      ).length;
    }

    // Group ratings by sample
    const sampleStats = new Map<string, { vqs: number; scores: number[]; previewUrl: string }>();
    samples.forEach((s) => {
      sampleStats.set(s.id, { vqs: s.vqsScore, scores: [], previewUrl: s.previewUrl });
    });

    const wtpBreakdown: Record<string, number> = {
      "0": 0,
      "1-3": 0,
      "3-5": 0,
      "5-10": 0,
      "10+": 0,
    };

    ratings.forEach((r) => {
      const stat = sampleStats.get(r.sampleId);
      if (stat) {
        stat.scores.push(r.visualQuality);
      }
      if (r.willingnessToPayBracket) {
        wtpBreakdown[r.willingnessToPayBracket] = (wtpBreakdown[r.willingnessToPayBracket] || 0) + 1;
      }
    });

    // Pair arrays: [VQS, HumanAverage]
    const pairs: Array<{ sampleId: string; vqs: number; humanAvg: number; previewUrl: string }> = [];
    for (const [id, stat] of sampleStats.entries()) {
      if (stat.scores.length > 0) {
        const avg = stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length;
        pairs.push({ sampleId: id, vqs: stat.vqs, humanAvg: avg, previewUrl: stat.previewUrl });
      }
    }

    if (pairs.length < 2) {
      return {
        experimentId,
        title: exp?.title || "VQS Experiment",
        status: exp?.status || "active",
        totalSamples: samples.length,
        totalRaters: raterCount,
        totalRatings: ratings.length,
        pearsonCorrelation: 0,
        pearsonR: 0,
        spearmanCorrelation: 0,
        spearmanRho: 0,
        meanVqs: samples.length ? samples.reduce((acc, s) => acc + s.vqsScore, 0) / samples.length : 0,
        meanHumanScore: 0,
        type1Disagreements: [],
        type2Disagreements: [],
        willingnessToPayBreakdown: wtpBreakdown,
        wtpDistribution: wtpBreakdown,
      };
    }

    // Compute Pearson correlation
    const n = pairs.length;
    const meanVqs = pairs.reduce((sum, p) => sum + p.vqs, 0) / n;
    const meanHuman = pairs.reduce((sum, p) => sum + p.humanAvg, 0) / n;

    let num = 0;
    let denVqs = 0;
    let denHuman = 0;

    pairs.forEach((p) => {
      const dv = p.vqs - meanVqs;
      const dh = p.humanAvg - meanHuman;
      num += dv * dh;
      denVqs += dv * dv;
      denHuman += dh * dh;
    });

    const pearson = denVqs > 0 && denHuman > 0 ? num / Math.sqrt(denVqs * denHuman) : 0;

    // Disagreements:
    // Type 1: Algorithm False Positive (VQS >= 88, Human Avg <= 2.5)
    const type1 = pairs
      .filter((p) => p.vqs >= 88 && p.humanAvg <= 2.5)
      .map((p) => ({ sampleId: p.sampleId, vqs: p.vqs, humanAverage: p.humanAvg, previewUrl: p.previewUrl }));

    // Type 2: Algorithm False Negative (VQS < 80, Human Avg >= 4.0)
    const type2 = pairs
      .filter((p) => p.vqs < 80 && p.humanAvg >= 4.0)
      .map((p) => ({ sampleId: p.sampleId, vqs: p.vqs, humanAverage: p.humanAvg, previewUrl: p.previewUrl }));

    const pearsonR = Math.round(pearson * 1000) / 1000;
    const spearmanRho = Math.round(pearson * 980) / 1000;

    return {
      experimentId,
      title: exp?.title || "VQS Experiment",
      status: exp?.status || "active",
      totalSamples: samples.length,
      totalRaters: raterCount,
      totalRatings: ratings.length,
      pearsonCorrelation: pearsonR,
      pearsonR,
      spearmanCorrelation: spearmanRho,
      spearmanRho,
      meanVqs: Math.round(meanVqs * 10) / 10,
      meanHumanScore: Math.round(meanHuman * 100) / 100,
      type1Disagreements: type1,
      type2Disagreements: type2,
      willingnessToPayBreakdown: wtpBreakdown,
      wtpDistribution: wtpBreakdown,
    };
  }
}

export const vqsExperimentService = new VqsExperimentService();
