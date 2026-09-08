import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await context.params;
    const userId = req.headers.get("x-user-id") || undefined;
    const versionNum = parseInt(versionId, 10);

    if (isNaN(versionNum)) {
      return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
    }

    const result = await packService.restoreVersion(id, versionNum, { userId });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to restore version" }, { status: 400 });
  }
}
