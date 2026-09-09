import { describe, it, expect } from "vitest";
import { checkComposition, inkCoverage } from "@gdp/qa";
import { evaluate } from "@gdp/qa";
import { Canvas, type DesignDocument } from "@gdp/design-schema";
import { vqsExperimentService } from "@/lib/vqs-experiment-service";

describe("VQS v1.1 & Blind Designer Calibration Experiment", () => {
  const canvas = Canvas.parse({
    width: 1080,
    height: 1350,
    margin: 40,
    safeArea: { top: 40, right: 40, bottom: 40, left: 40 },
  });

  const fullDoc: DesignDocument = {
    schemaVersion: "1.0",
    id: "doc_test_full",
    canvas,
    palette: {
      primary: "#111111",
      secondary: "#f59e0b",
      accent: "#ffffff",
      background: "#0b0b0f",
      surface: "#1f2937",
      text: "#ffffff",
      muted: "#9ca3af",
    },
    typeScale: {
      display: { family: "Inter", size: 64, weight: 800, lineHeight: 1.1 },
      headline: { family: "Inter", size: 48, weight: 700, lineHeight: 1.2 },
      title: { family: "Inter", size: 32, weight: 600, lineHeight: 1.25 },
      body: { family: "Inter", size: 16, weight: 400, lineHeight: 1.5 },
      caption: { family: "Inter", size: 12, weight: 400, lineHeight: 1.4 },
    },
    assetIds: ["ast_1"],
    meta: {
      title: "Conference",
      category: "church",
      subcategory: "revival",
      styleDirection: "bold",
      composition: "split-horizontal",
      referenceIds: [],
      plannerModel: "gpt",
      createdAt: new Date().toISOString(),
      notes: "Promo",
    },
    layers: [
      {
        id: "subject",
        type: "image",
        name: "Subject",
        slot: "subject",
        visible: true,
        locked: false,
        zIndex: 2,
        x: 100,
        y: 300,
        width: 880,
        height: 600,
        rotation: 0,
        opacity: 1,
        assetId: "ast_1",
        maskAssetId: null,
        crop: { x: 0, y: 0, width: 1, height: 1 },
        fit: "cover",
      },
      {
        id: "headline",
        type: "text",
        name: "Headline",
        slot: "headline",
        visible: true,
        locked: false,
        zIndex: 3,
        x: 80,
        y: 100,
        width: 920,
        height: 150,
        rotation: 0,
        opacity: 1,
        content: "LEADERSHIP CONFERENCE 2026",
        fontFamily: "Inter",
        fontSize: 54,
        fontWeight: 800,
        color: "#ffffff",
        align: "center",
        verticalAlign: "top",
        transform: "none",
        lineHeight: 1.1,
        letterSpacing: 0,
        maxLines: 2,
        fit: "shrink",
        lines: [{ text: "LEADERSHIP CONFERENCE 2026", width: 900, baseline: 60 }],
        overflow: false,
      },
    ],
  };

  const sparseDoc: DesignDocument = {
    schemaVersion: "1.0",
    id: "doc_test_sparse",
    canvas,
    palette: fullDoc.palette,
    typeScale: fullDoc.typeScale,
    assetIds: [],
    meta: fullDoc.meta,
    layers: [
      {
        id: "tiny_text",
        type: "text",
        name: "Tiny Text",
        slot: "footnote",
        visible: true,
        locked: false,
        zIndex: 1,
        x: 500,
        y: 600,
        width: 80,
        height: 25,
        rotation: 0,
        opacity: 1,
        content: "Sale",
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: 400,
        color: "#000000",
        align: "left",
        verticalAlign: "top",
        transform: "none",
        lineHeight: 1.1,
        letterSpacing: 0,
        maxLines: 1,
        fit: "shrink",
        lines: [{ text: "Sale", width: 40, baseline: 12 }],
        overflow: false,
      },
    ],
  };

  it("penalizes sparse designs in VQS v1.1 composition check", () => {
    const fullComp = checkComposition(fullDoc, { vqsVersion: "1.1" });
    expect(fullComp.score).toBeGreaterThan(70);
    expect(inkCoverage(fullDoc)).toBeGreaterThan(0.2);

    const sparseComp = checkComposition(sparseDoc, { vqsVersion: "1.1" });
    // Sparse document has severe penalty
    expect(sparseComp.score).toBeLessThan(45);
    expect(inkCoverage(sparseDoc)).toBeLessThan(0.05);
    expect(sparseComp.issues.some((i) => i.code === "sparse")).toBe(true);
  });

  it("records vqsVersion, contentDensityRatio, and blocking status in evaluate()", () => {
    const report = evaluate(sparseDoc, { vqsVersion: "1.1" });
    expect(report.vqsVersion).toBe("1.1");
    expect(report.contentDensityRatio).toBeDefined();
    expect(report.contentDensityRatio).toBeLessThan(0.05);
    expect(report.total).toBeLessThan(70); // Failed quality threshold!
  });

  it("executes double-blind rater experiment flow without exposing internal scores", async () => {
    // 1. Create experiment
    const exp = await vqsExperimentService.createExperiment({
      name: "Q3 Blind Designer Calibration",
      description: "Evaluating VQS v1.1 correlation against human creative directors",
      targetRaters: 5,
    });
    expect(exp.id).toBeDefined();
    expect(exp.status).toBe("active");

    // 2. Add sample
    const sample = await vqsExperimentService.addSample(exp.id, {
      packId: "pack_test_1",
      conceptId: "concept_test_1",
      previewUrl: "/previews/sample1.png",
      vqsScore: 88.5,
      vqsVersion: "1.1",
      vqsReport: { score: 88.5, passed: true },
      briefSummary: "Annual Youth Revival",
    });
    expect(sample.id).toBeDefined();

    // 3. Register rater
    const rater = await vqsExperimentService.registerRater(exp.id, {
      name: "Chukwudi Okafor",
      email: "chukwudi@design.studio",
      experienceYears: 7,
      role: "Art Director",
    });
    expect(rater.blindToken).toBeDefined();

    // 4. Retrieve blinded queue: must NOT contain vqsScore or vqsReport
    const queue = await vqsExperimentService.getBlindedSampleQueue(rater.blindToken);
    expect(queue.length).toBeGreaterThan(0);
    const blindedItem = queue[0]!;
    expect(blindedItem.previewUrl).toBe("/previews/sample1.png");
    expect((blindedItem as any).vqsScore).toBeUndefined();
    expect((blindedItem as any).vqsReport).toBeUndefined();

    // 5. Submit rating
    const ratingResult = await vqsExperimentService.submitRating(rater.blindToken, {
      sampleId: sample.id,
      overallQuality: 4,
      typographyScore: 4,
      hierarchyScore: 5,
      brandAppropriateness: 4,
      commercialViability: 4,
      wouldPayForThis: "yes_9_99_bundle",
      feedback: "Strong typography and visual punch, excellent balance.",
    });
    expect(ratingResult.success).toBe(true);

    // 6. Submitting duplicate rating updates existing without error
    const duplicateSubmission = await vqsExperimentService.submitRating(rater.blindToken, {
      sampleId: sample.id,
      overallQuality: 5,
      typographyScore: 5,
      hierarchyScore: 5,
      brandAppropriateness: 5,
      commercialViability: 5,
      wouldPayForThis: "yes_9_99_bundle",
    });
    expect(duplicateSubmission.success).toBe(true);

    // 7. Generate correlation report
    const report = await vqsExperimentService.generateCorrelationReport(exp.id);
    expect(report.experimentId).toBe(exp.id);
    expect(report.totalRatings).toBe(1);
    expect(report.pearsonR).toBeDefined();
    expect(report.spearmanRho).toBeDefined();
    expect(report.wtpDistribution["yes_9_99_bundle"]).toBe(1);
  });
});
