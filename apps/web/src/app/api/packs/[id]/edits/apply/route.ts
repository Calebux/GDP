import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";
import { trackEvent } from "@/lib/analytics";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const instruction = body?.instruction?.trim();
    const userId = req.headers.get("x-user-id") || body?.userId || undefined;

    if (!instruction) {
      return NextResponse.json({ error: "Please provide an edit instruction" }, { status: 400 });
    }

    await trackEvent({
      type: "edit_confirmed",
      packId: id,
      userId,
      payload: { instruction },
    });

    const result = await packService.applyEdit(id, instruction, { userId });
    return NextResponse.json(result);
  } catch (err: any) {
    await trackEvent({
      type: "edit_failed",
      payload: { error: err?.message },
    });
    return NextResponse.json(
      { error: err?.message || "Failed to apply edit" },
      { status: 400 }
    );
  }
}
