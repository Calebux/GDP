import { vqsExperimentService } from "../apps/web/src/lib/vqs-experiment-service.js";

async function main() {
  const experimentId = process.argv[2] || "exp_active_baseline";
  console.log(`\n======================================================`);
  console.log(`   GDP Platform: VQS Human Calibration Analysis Tool`);
  console.log(`   Experiment ID: ${experimentId}`);
  console.log(`======================================================\n`);

  try {
    const report = await vqsExperimentService.generateCorrelationReport(experimentId);

    console.log(`Status: ${report.status}`);
    console.log(`Total Samples Sampled: ${report.totalSamples}`);
    console.log(`Total Qualified Raters: ${report.totalRaters}`);
    console.log(`Total Evaluations Collected: ${report.totalRatings}`);
    console.log(`------------------------------------------------------`);
    console.log(`Mean VQS Score:            ${report.meanVqs} / 100`);
    console.log(`Mean Human Score:          ${report.meanHumanScore} / 5.0`);
    console.log(`Pearson Correlation (r):   ${report.pearsonCorrelation.toFixed(3)}`);
    console.log(`Spearman Correlation (ρ):  ${report.spearmanCorrelation.toFixed(3)}`);
    console.log(`------------------------------------------------------`);

    console.log(`\nWillingness-to-Pay Breakdown:`);
    Object.entries(report.willingnessToPayBreakdown).forEach(([bracket, count]) => {
      console.log(`  $${bracket.padEnd(5)} : ${count} votes`);
    });

    console.log(`\nDisagreement Analysis:`);
    console.log(`Type I (Algorithm False Positives — VQS ≥ 88, Human ≤ 2.5): ${report.type1Disagreements.length}`);
    report.type1Disagreements.slice(0, 3).forEach((d) => {
      console.log(`   - Sample ${d.sampleId}: VQS ${d.vqs}, Human Avg ${d.humanAverage.toFixed(1)}`);
    });

    console.log(`Type II (Algorithm False Negatives — VQS < 80, Human ≥ 4.0): ${report.type2Disagreements.length}`);
    report.type2Disagreements.slice(0, 3).forEach((d) => {
      console.log(`   - Sample ${d.sampleId}: VQS ${d.vqs}, Human Avg ${d.humanAverage.toFixed(1)}`);
    });

    console.log(`\nEvaluation Verdict:`);
    if (report.totalRatings < 20) {
      console.log(`[PENDING] Insufficient sample size (${report.totalRatings}/250 ratings). Experiment remains open.`);
    } else if (report.spearmanCorrelation >= 0.65) {
      console.log(`[VALIDATED] Strong correlation (ρ ≥ 0.65). VQS accurately reflects designer craft.`);
    } else {
      console.log(`[CALIBRATION REQUIRED] Moderate/weak correlation. Recalibrate heuristic weights.`);
    }
    console.log(`======================================================\n`);
  } catch (err: any) {
    console.error("Error running correlation report:", err.message);
  }
}

main().catch(console.error);
