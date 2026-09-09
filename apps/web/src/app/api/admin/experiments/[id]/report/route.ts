import { NextRequest, NextResponse } from "next/server";
import { vqsExperimentService } from "@/lib/vqs-experiment-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const report = await vqsExperimentService.generateCorrelationReport(id);
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to generate report" }, { status: 500 });
  }
}
