import { db, dbAvailable, visionMetering } from "@gdp/db";
import { newId, createLogger } from "@gdp/core";

const log = createLogger("vision-cogs");

export interface VisionMetricRecord {
  id: string;
  operation: "cutout" | "composition" | "ink_coverage" | "visual_balance" | string;
  provider: "fastapi_u2net" | "rembg_local" | "replicate" | "fal" | "sharp_fallback" | string;
  latencyMs: number;
  imageBytes?: number;
  costUsd: number;
  packId?: string;
  success: boolean;
  createdAt: string;
}

export interface VisionCogsSummary {
  timestamp: string;
  totalCalls: number;
  totalCostUsd: number;
  avgCostPerCallUsd: number;
  estimatedCostPerPackUsd: number; // assuming avg 3 concepts * 1 cutout = 3 calls
  callsByOperation: Record<string, { calls: number; costUsd: number; avgLatencyMs: number }>;
  callsByProvider: Record<string, { calls: number; costUsd: number; avgLatencyMs: number }>;
  projectedMonthlySavingsUsd: number; // vs $0.03/call commercial API
  records: VisionMetricRecord[];
}

// In-memory fallback
const memoryMetrics: VisionMetricRecord[] = [];

export async function recordVisionMetric(params: {
  operation: string;
  provider: string;
  latencyMs: number;
  imageBytes?: number;
  costUsd?: number;
  packId?: string;
  success?: boolean;
}): Promise<VisionMetricRecord> {
  const record: VisionMetricRecord = {
    id: `vm_${newId("vis")}`,
    operation: params.operation,
    provider: params.provider,
    latencyMs: Math.round(params.latencyMs),
    imageBytes: params.imageBytes,
    costUsd: params.costUsd ?? (params.provider.startsWith("fastapi") ? 0.0004 : 0.02),
    packId: params.packId,
    success: params.success ?? true,
    createdAt: new Date().toISOString(),
  };

  memoryMetrics.push(record);

  if (await dbAvailable()) {
    try {
      const database = db();
      await database.insert(visionMetering).values({
        id: record.id,
        packId: record.packId ?? null,
        provider: record.provider,
        model: "u2net",
        operationType: record.operation,
        inputBytes: record.imageBytes ?? 0,
        outputBytes: 0,
        durationMs: record.latencyMs,
        success: record.success,
        estimatedCostUsd: record.costUsd,
        createdAt: new Date(record.createdAt),
      });
    } catch (err) {
      log.warn("Failed to persist vision metric to PostgreSQL", { error: String(err) });
    }
  }

  return record;
}

export async function getVisionCogsReport(): Promise<VisionCogsSummary> {
  let records = memoryMetrics;

  if (await dbAvailable()) {
    try {
      const database = db();
      const rows = await database.select().from(visionMetering);
      if (rows.length > 0) {
        records = rows.map((r) => ({
          id: r.id,
          operation: r.operationType,
          provider: r.provider,
          latencyMs: r.durationMs || 0,
          imageBytes: r.inputBytes ?? undefined,
          costUsd: r.estimatedCostUsd ?? 0,
          packId: r.packId ?? undefined,
          success: r.success ?? true,
          createdAt: r.createdAt.toISOString(),
        }));
      }
    } catch (err) {
      log.warn("Failed reading vision_metering from PostgreSQL", { error: String(err) });
    }
  }

  const callsByOperation: Record<string, { calls: number; costUsd: number; totalLatency: number }> = {};
  const callsByProvider: Record<string, { calls: number; costUsd: number; totalLatency: number }> = {};

  let totalCostUsd = 0;

  for (const r of records) {
    totalCostUsd += r.costUsd;

    // Operation breakdown
    if (!callsByOperation[r.operation]) {
      callsByOperation[r.operation] = { calls: 0, costUsd: 0, totalLatency: 0 };
    }
    const opEntry = callsByOperation[r.operation]!;
    opEntry.calls++;
    opEntry.costUsd += r.costUsd;
    opEntry.totalLatency += r.latencyMs;

    // Provider breakdown
    if (!callsByProvider[r.provider]) {
      callsByProvider[r.provider] = { calls: 0, costUsd: 0, totalLatency: 0 };
    }
    const provEntry = callsByProvider[r.provider]!;
    provEntry.calls++;
    provEntry.costUsd += r.costUsd;
    provEntry.totalLatency += r.latencyMs;
  }

  const opResult: Record<string, { calls: number; costUsd: number; avgLatencyMs: number }> = {};
  for (const [op, data] of Object.entries(callsByOperation)) {
    opResult[op] = {
      calls: data.calls,
      costUsd: Math.round(data.costUsd * 10000) / 10000,
      avgLatencyMs: Math.round(data.totalLatency / (data.calls || 1)),
    };
  }

  const provResult: Record<string, { calls: number; costUsd: number; avgLatencyMs: number }> = {};
  for (const [prov, data] of Object.entries(callsByProvider)) {
    provResult[prov] = {
      calls: data.calls,
      costUsd: Math.round(data.costUsd * 10000) / 10000,
      avgLatencyMs: Math.round(data.totalLatency / (data.calls || 1)),
    };
  }

  const totalCalls = records.length;
  const avgCostPerCall = totalCalls > 0 ? totalCostUsd / totalCalls : 0;
  // If we had used hosted API at $0.025/call:
  const baselineHostedCost = totalCalls * 0.025;
  const actualSavings = Math.max(0, baselineHostedCost - totalCostUsd);

  return {
    timestamp: new Date().toISOString(),
    totalCalls,
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    avgCostPerCallUsd: Math.round(avgCostPerCall * 10000) / 10000,
    estimatedCostPerPackUsd: Math.round(avgCostPerCall * 3 * 10000) / 10000,
    callsByOperation: opResult,
    callsByProvider: provResult,
    projectedMonthlySavingsUsd: Math.round(actualSavings * 100) / 100,
    records: records.slice(-50), // last 50 entries
  };
}

export function clearVisionCogsMemory(): void {
  memoryMetrics.length = 0;
}
