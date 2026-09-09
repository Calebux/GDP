import { NextRequest, NextResponse } from "next/server";
import { vqsExperimentService } from "@/lib/vqs-experiment-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const queue = await vqsExperimentService.getBlindedSampleQueue(token);
    return NextResponse.json({ queue });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unauthorized rater" }, { status: 403 });
  }
}
