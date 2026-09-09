import { NextRequest, NextResponse } from "next/server";
import { vqsExperimentService } from "@/lib/vqs-experiment-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await req.json();
    const { sampleId, rating } = body;

    if (!sampleId || !rating) {
      return NextResponse.json({ error: "Missing sampleId or rating" }, { status: 400 });
    }

    const result = await vqsExperimentService.submitRating(token, sampleId, rating);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Rating submission failed" }, { status: 400 });
  }
}
