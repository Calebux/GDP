import { describe, it, expect } from "vitest";
import { trackEvent, getFunnelMetrics } from "@/lib/analytics";
import { GET as funnelRoute } from "@/app/api/analytics/funnel/route";

describe("D-03: Funnel Analytics & Conversion Rate", () => {
  it("tracks core events and calculates preview-to-purchase conversion rate accurately", async () => {
    const session1 = "sess_conv_1";
    const session2 = "sess_conv_2";

    // Session 1 views preview, checks out, and purchases
    await trackEvent({ type: "preview_viewed", sessionId: session1 });
    await trackEvent({ type: "checkout_started", sessionId: session1 });
    await trackEvent({ type: "payment_succeeded", sessionId: session1, payload: { productId: "bundle-5" } });

    // Session 2 views preview only
    await trackEvent({ type: "preview_viewed", sessionId: session2 });

    const metrics = await getFunnelMetrics();
    expect(metrics.previewViews).toBeGreaterThanOrEqual(2);
    expect(metrics.checkoutStarts).toBeGreaterThanOrEqual(1);
    expect(metrics.purchases).toBeGreaterThanOrEqual(1);
    expect(metrics.previewToPurchaseConversionRate).toBeGreaterThan(0);
    expect(metrics.bundlePurchases).toBeGreaterThanOrEqual(1);

    // Call API route
    const res = await funnelRoute();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.formula).toContain("previewToPurchaseConversionRate");
    expect(data.metrics.previewViews).toBeGreaterThanOrEqual(2);
  });
});
