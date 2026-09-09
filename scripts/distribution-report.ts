#!/usr/bin/env tsx
/**
 * Distribution Loop & Cohort Report CLI
 * Computes weekly cohorts, preview-to-purchase conversion, viral K-factor (referrals/purchases),
 * cycle times, and acquisition channel attribution.
 *
 * Usage:
 *   npx tsx scripts/distribution-report.ts
 */

import { getCohortReport } from "../apps/web/src/lib/analytics";

async function main() {
  console.log("==========================================================");
  console.log("       GDP DISTRIBUTION LOOP & COHORT REPORT (D-05)       ");
  console.log("==========================================================\n");

  const report = await getCohortReport();

  console.log(`Generated At:             ${report.timestamp}`);
  console.log(`Total Tracked Users:      ${report.totalUsers}`);
  console.log(`Total Purchases:          ${report.totalPurchases}`);
  console.log(`Total Shares Created:     ${report.totalShares}`);
  console.log(`Total Share Link Views:   ${report.totalShareViews}`);
  console.log(`Total Referral Purchases: ${report.totalReferralPurchases}`);
  console.log(`Global Viral K-Factor:    ${report.globalKFactor}`);

  if (report.globalKFactor >= 1.0) {
    console.log(">> STATUS: VIRAL EXPANSION (K >= 1.0) — Compounding self-sustaining growth!");
  } else if (report.globalKFactor > 0.3) {
    console.log(">> STATUS: STRONG MULTIPLIER (0.3 <= K < 1.0) — Amplifying paid/organic acquisition.");
  } else {
    console.log(">> STATUS: NASCENT / UNDER-INSTRUMENTED (K < 0.3) — Requires active user cohorts.");
  }

  console.log("\n----------------------------------------------------------");
  console.log("WEEKLY COHORT PERFORMANCE");
  console.log("----------------------------------------------------------");
  if (report.cohorts.length === 0) {
    console.log("No cohort activity recorded yet. Run user sessions or tests to seed events.");
  } else {
    for (const c of report.cohorts) {
      console.log(`Cohort [${c.cohortWeek}]:`);
      console.log(`  New Users:           ${c.newUsersCount}`);
      console.log(`  Packs Created:       ${c.packsCreated}`);
      console.log(`  Purchases:           ${c.purchasesCount}`);
      console.log(`  Conversion Rate:     ${c.conversionRate}%`);
      console.log(`  Shares Created:      ${c.sharesCreated}`);
      console.log(`  Referral Purchases:  ${c.referralPurchases}`);
      console.log(`  Cohort K-Factor:     ${c.kFactor}`);
      console.log(`  Avg Cycle Time:      ${c.viralCycleHoursAvg} hours`);
      console.log("  Acquisition Channels:");
      for (const [ch, data] of Object.entries(c.byChannel)) {
        console.log(`    - ${ch}: ${data.users} users, ${data.purchases} purchases`);
      }
      console.log("");
    }
  }

  console.log("==========================================================\n");
}

main().catch((err) => {
  console.error("Failed to generate distribution report:", err);
  process.exit(1);
});
