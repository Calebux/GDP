import crypto from "node:crypto";
import { env } from "./env.js";
import { createLogger } from "./logger.js";

const log = createLogger("vision-client");

export interface CutoutResult {
  imageBase64: string;
  width: number;
  height: number;
  latencyMs: number;
  subjectBox?: [number, number, number, number];
  provider: "fastapi_u2net" | "local_fallback" | "circuit_breaker_open";
}

export interface VisionAnalysisResult {
  width: number;
  height: number;
  inkCoverage: number;
  densityRatio: number;
  visualBalance: {
    centerOfMassX: number;
    centerOfMassY: number;
    horizontalSkew: number;
    verticalSkew: number;
  };
  latencyMs: number;
  provider: "fastapi_u2net" | "local_fallback" | "circuit_breaker_open";
}

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class VisionCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: CircuitBreakerState = "CLOSED";
  private readonly failureThreshold = 3;
  private readonly cooldownMs = 30000; // 30 seconds

  getState(): CircuitBreakerState {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = "HALF_OPEN";
        log.info("Vision circuit breaker transitioned to HALF_OPEN");
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      log.warn("Vision circuit breaker tripped to OPEN", {
        failureCount: this.failureCount,
        cooldownMs: this.cooldownMs,
      });
    }
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = "CLOSED";
  }
}

export class VisionClient {
  private breaker = new VisionCircuitBreaker();
  private metricHook?: (metric: {
    operation: string;
    provider: string;
    latencyMs: number;
    costUsd: number;
    success: boolean;
  }) => Promise<void>;

  constructor(
    metricHook?: (metric: {
      operation: string;
      provider: string;
      latencyMs: number;
      costUsd: number;
      success: boolean;
    }) => Promise<void>,
  ) {
    this.metricHook = metricHook;
  }

  getCircuitState(): CircuitBreakerState {
    return this.breaker.getState();
  }

  resetCircuitBreaker(): void {
    this.breaker.reset();
  }

  /**
   * Request subject background cutout.
   */
  async removeBackground(
    imageBase64: string,
    packId?: string,
  ): Promise<CutoutResult> {
    const e = env();
    const serviceUrl = (e.VISION_SERVICE_URL || "http://localhost:8000").replace(/\/$/, "");
    const isEnabled = e.ENABLE_VISION_SERVICE;
    const circuitState = this.breaker.getState();

    // 1. Fallback if disabled or circuit open
    if (!isEnabled || circuitState === "OPEN") {
      log.info("Vision service bypassed, using local fallback", {
        isEnabled,
        circuitState,
      });
      return {
        imageBase64,
        width: 1080,
        height: 1080,
        latencyMs: 1,
        provider: circuitState === "OPEN" ? "circuit_breaker_open" : "local_fallback",
      };
    }

    const start = performance.now();
    try {
      const payload = JSON.stringify({ image_base64: imageBase64, pack_id: packId });
      const secret = e.VISION_SERVICE_SECRET || "gdp-vision-dev-secret";

      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch(`${serviceUrl}/v1/cutout/json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
          "X-GDP-Signature": signature,
        },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Vision service HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const latencyMs = performance.now() - start;

      this.breaker.recordSuccess();

      if (this.metricHook) {
        this.metricHook({
          operation: "cutout",
          provider: "fastapi_u2net",
          latencyMs,
          costUsd: 0.0004,
          success: true,
        }).catch(() => {});
      }

      return {
        imageBase64: data.image_base64,
        width: data.width,
        height: data.height,
        latencyMs,
        subjectBox: data.subject_box,
        provider: "fastapi_u2net",
      };
    } catch (err: any) {
      const latencyMs = performance.now() - start;
      this.breaker.recordFailure();

      log.warn("Vision cutout failed, falling back to original image", {
        error: String(err),
        circuitState: this.breaker.getState(),
      });

      if (this.metricHook) {
        this.metricHook({
          operation: "cutout",
          provider: "local_fallback",
          latencyMs,
          costUsd: 0,
          success: false,
        }).catch(() => {});
      }

      return {
        imageBase64,
        width: 1080,
        height: 1080,
        latencyMs,
        provider: "local_fallback",
      };
    }
  }

  /**
   * Request visual analysis (ink coverage, center of mass, density ratio).
   */
  async analyzeVisualComposition(
    imageBase64: string,
  ): Promise<VisionAnalysisResult> {
    const e = env();
    const serviceUrl = (e.VISION_SERVICE_URL || "http://localhost:8000").replace(/\/$/, "");
    const isEnabled = e.ENABLE_VISION_SERVICE;
    const circuitState = this.breaker.getState();

    if (!isEnabled || circuitState === "OPEN") {
      return {
        width: 1080,
        height: 1080,
        inkCoverage: 0.22,
        densityRatio: 0.55,
        visualBalance: {
          centerOfMassX: 0.5,
          centerOfMassY: 0.5,
          horizontalSkew: 0,
          verticalSkew: 0,
        },
        latencyMs: 1,
        provider: circuitState === "OPEN" ? "circuit_breaker_open" : "local_fallback",
      };
    }

    const start = performance.now();
    try {
      const payload = JSON.stringify({ image_base64: imageBase64 });
      const secret = e.VISION_SERVICE_SECRET || "gdp-vision-dev-secret";

      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${serviceUrl}/v1/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
          "X-GDP-Signature": signature,
        },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Vision service HTTP ${res.status}`);
      }

      const data = await res.json();
      const latencyMs = performance.now() - start;

      this.breaker.recordSuccess();

      if (this.metricHook) {
        this.metricHook({
          operation: "composition",
          provider: "fastapi_u2net",
          latencyMs,
          costUsd: 0.0002,
          success: true,
        }).catch(() => {});
      }

      return {
        width: data.width,
        height: data.height,
        inkCoverage: data.ink_coverage,
        densityRatio: data.density_ratio,
        visualBalance: {
          centerOfMassX: data.visual_balance.center_of_mass_x,
          centerOfMassY: data.visual_balance.center_of_mass_y,
          horizontalSkew: data.visual_balance.horizontal_skew,
          verticalSkew: data.visual_balance.vertical_skew,
        },
        latencyMs,
        provider: "fastapi_u2net",
      };
    } catch (err: any) {
      const latencyMs = performance.now() - start;
      this.breaker.recordFailure();

      if (this.metricHook) {
        this.metricHook({
          operation: "composition",
          provider: "local_fallback",
          latencyMs,
          costUsd: 0,
          success: false,
        }).catch(() => {});
      }

      return {
        width: 1080,
        height: 1080,
        inkCoverage: 0.22,
        densityRatio: 0.55,
        visualBalance: {
          centerOfMassX: 0.5,
          centerOfMassY: 0.5,
          horizontalSkew: 0,
          verticalSkew: 0,
        },
        latencyMs,
        provider: "local_fallback",
      };
    }
  }
}

export const visionClient = new VisionClient();
