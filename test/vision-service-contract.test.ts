import { describe, it, expect, beforeEach } from "vitest";
import { VisionClient, VisionCircuitBreaker } from "@gdp/core";
import {
  recordVisionMetric,
  getVisionCogsReport,
  clearVisionCogsMemory,
} from "@/lib/vision-cogs";

describe("D-17 Vision Microservice & COGS Metering", () => {
  beforeEach(() => {
    clearVisionCogsMemory();
  });

  it("trips circuit breaker to OPEN after 3 consecutive failures", () => {
    const breaker = new VisionCircuitBreaker();
    expect(breaker.getState()).toBe("CLOSED");

    breaker.recordFailure();
    expect(breaker.getState()).toBe("CLOSED");

    breaker.recordFailure();
    expect(breaker.getState()).toBe("CLOSED");

    breaker.recordFailure();
    expect(breaker.getState()).toBe("OPEN");

    breaker.reset();
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("falls back gracefully when vision service is disabled or breaker is open", async () => {
    const client = new VisionClient();

    // Default configuration has ENABLE_VISION_SERVICE=false
    const cutout = await client.removeBackground("data:image/png;base64,mock");
    expect(cutout.provider).toBe("local_fallback");
    expect(cutout.latencyMs).toBeLessThanOrEqual(5);

    const analysis = await client.analyzeVisualComposition("data:image/png;base64,mock");
    expect(analysis.provider).toBe("local_fallback");
    expect(analysis.inkCoverage).toBeGreaterThan(0);
    expect(analysis.densityRatio).toBeGreaterThan(0);
  });

  it("records vision metrics and aggregates unit economics report", async () => {
    // 1. Record cutout call
    await recordVisionMetric({
      operation: "cutout",
      provider: "fastapi_u2net",
      latencyMs: 145,
      costUsd: 0.0004,
      packId: "pack_test_1",
      success: true,
    });

    // 2. Record composition analysis call
    await recordVisionMetric({
      operation: "composition",
      provider: "fastapi_u2net",
      latencyMs: 25,
      costUsd: 0.0002,
      packId: "pack_test_1",
      success: true,
    });

    // 3. Record commercial fallback call
    await recordVisionMetric({
      operation: "cutout",
      provider: "replicate",
      latencyMs: 1800,
      costUsd: 0.025,
      packId: "pack_test_2",
      success: true,
    });

    const report = await getVisionCogsReport();
    expect(report.totalCalls).toBe(3);
    expect(report.totalCostUsd).toBeCloseTo(0.0256, 4);
    expect(report.callsByOperation["cutout"]).toBeDefined();
    expect(report.callsByOperation["cutout"]?.calls).toBe(2);
    expect(report.callsByProvider["fastapi_u2net"]).toBeDefined();
    expect(report.callsByProvider["fastapi_u2net"]?.calls).toBe(2);
  });
});
