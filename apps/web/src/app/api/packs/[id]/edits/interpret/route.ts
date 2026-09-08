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

    if (!instruction) {
      return NextResponse.json({ error: "Please provide an edit instruction" }, { status: 400 });
    }

    const interpretation = await packService.interpretEdit(id, instruction);

    await trackEvent({
      type: "edit_submitted",
      packId: id,
      payload: {
        instruction,
        summary: interpretation.summary,
        opsCount: interpretation.opsCount,
      },
    });

    return NextResponse.json(interpretation);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "I couldn't confidently understand that change. Try something like: 'Change the date to October 12.'" },
      { status: 400 }
    );
  }
}
