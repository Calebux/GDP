import { NextRequest, NextResponse } from "next/server";
import { packRepository } from "@/lib/pack-repository";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const versions = await packRepository.getPackVersions(id);
    return NextResponse.json({ versions });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load versions" }, { status: 400 });
  }
}
