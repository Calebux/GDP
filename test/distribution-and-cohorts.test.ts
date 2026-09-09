import { describe, it, expect, beforeEach } from "vitest";
import {
  trackEvent,
  getCohortReport,
  clearAnalyticsMemory,
} from "@/lib/analytics";

describe("D-05 Distribution Loop, Cohorts & Attribution", () => {
  beforeEach(() => {
    clearAnalyticsMemory();
  });

  it("records events with referral tokens and attribution tags", async () => {
    await trackEvent({
      type: "preview_viewed",
      userId: "user_buyer_1",
      packId: "pack_1",
      utmSource: "instagram",
      utmMedium: "cpc",
      utmCampaign: "church_launch",
    });

    await trackEvent({
      type: "payment_succeeded",
      userId: "user_buyer_1",
      packId: "pack_1",
      payload: { amount: 299, currency: "usd" },
      utmSource: "instagram",
    });

    await trackEvent({
      type: "share_created",
      userId: "user_buyer_1",
      packId: "pack_1",
      payload: { token: "share_token_abc" },
    });

    // Recipient views share link
    await trackEvent({
      type: "share_viewed",
      userId: "user_viral_2",
      referralToken: "share_token_abc",
    });

    // Recipient converts
    await trackEvent({
      type: "referral_purchase",
      userId: "user_viral_2",
      referralToken: "share_token_abc",
      payload: { amount: 299, currency: "usd" },
    });

    const report = await getCohortReport();
    expect(report.totalUsers).toBeGreaterThanOrEqual(2);
    expect(report.totalPurchases).toBe(1);
    expect(report.totalShares).toBe(1);
    expect(report.totalShareViews).toBe(1);
    expect(report.totalReferralPurchases).toBe(1);

    // K-Factor: 1 referral purchase / 1 direct purchase = 1.0 (viral expansion!)
    expect(report.globalKFactor).toBe(1.0);
    expect(report.cohorts.length).toBeGreaterThan(0);

    const activeCohort = report.cohorts[0]!;
    expect(activeCohort.sharesCreated).toBe(1);
    expect(activeCohort.referralPurchases).toBe(1);
    expect(activeCohort.kFactor).toBe(1.0);
    expect(activeCohort.byChannel["instagram"]).toBeDefined();
    expect(activeCohort.byChannel["instagram"]?.purchases).toBe(1);
  });
});
