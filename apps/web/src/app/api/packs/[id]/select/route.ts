import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { conceptId, requestedFormats } = body;

    if (!conceptId) {
      return NextResponse.json({ error: "conceptId is required" }, { status: 400 });
    }

    const pack = await packService.selectConcept(id, conceptId, requestedFormats);
    return NextResponse.json({ pack });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to select concept" }, { status: 400 });
  }
}
