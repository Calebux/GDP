import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await packService.createCheckout(id);
    return NextResponse.json(session);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to initiate checkout" }, { status: 400 });
  }
}
