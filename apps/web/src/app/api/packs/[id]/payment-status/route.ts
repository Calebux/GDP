import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id") || undefined;

    const result = await packService.verifyAndProcessPayment(id, sessionId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Payment verification failed" }, { status: 400 });
  }
}
