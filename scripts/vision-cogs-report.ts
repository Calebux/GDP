#!/usr/bin/env tsx
/**
 * Vision Service COGS & Unit Economics Report CLI
 * Audits vision model execution (cutouts, composition, ink coverage),
 * measures latency, and compares self-hosted vs cloud API unit economics.
 *
 * Usage:
 *   npx tsx scripts/vision-cogs-report.ts
 */

import { getVisionCogsReport } from "../apps/web/src/lib/vision-cogs";

async function main() {
  console.log("==========================================================");
  console.log("       GDP VISION SERVICE COGS & UNIT ECONOMICS (D-17)    ");
  console.log("==========================================================\n");

  const report = await getVisionCogsReport();

  console.log(`Generated At:                ${report.timestamp}`);
  console.log(`Total Vision Calls:          ${report.totalCalls}`);
  console.log(`Total Direct Compute Cost:   $${report.totalCostUsd.toFixed(4)}`);
  console.log(`Average Cost Per Call:       $${report.avgCostPerCallUsd.toFixed(5)}`);
  console.log(`Estimated Vision Cost/Pack:  $${report.estimatedCostPerPackUsd.toFixed(4)} (3 concepts/pack)`);
  console.log(`Estimated Savings vs Cloud:  $${report.projectedMonthlySavingsUsd.toFixed(2)} (baseline $0.025/call)`);

  console.log("\n----------------------------------------------------------");
  console.log("BREAKDOWN BY OPERATION");
  console.log("----------------------------------------------------------");
  if (Object.keys(report.callsByOperation).length === 0) {
    console.log("No vision operations recorded yet.");
  } else {
    for (const [op, data] of Object.entries(report.callsByOperation)) {
      console.log(`[${op}]`);
      console.log(`  Calls:        ${data.calls}`);
      console.log(`  Total Cost:   $${data.costUsd.toFixed(4)}`);
      console.log(`  Avg Latency:  ${data.avgLatencyMs} ms`);
    }
  }

  console.log("\n----------------------------------------------------------");
  console.log("BREAKDOWN BY PROVIDER");
  console.log("----------------------------------------------------------");
  if (Object.keys(report.callsByProvider).length === 0) {
    console.log("No providers recorded yet.");
  } else {
    for (const [prov, data] of Object.entries(report.callsByProvider)) {
      console.log(`[${prov}]`);
      console.log(`  Calls:        ${data.calls}`);
      console.log(`  Total Cost:   $${data.costUsd.toFixed(4)}`);
      console.log(`  Avg Latency:  ${data.avgLatencyMs} ms`);
    }
  }

  console.log("\n==========================================================\n");
}

main().catch((err) => {
  console.error("Failed to generate vision COGS report:", err);
  process.exit(1);
});
