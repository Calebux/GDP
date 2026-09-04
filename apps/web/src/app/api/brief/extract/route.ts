import { NextRequest, NextResponse } from "next/server";
import { extractBrief } from "@/lib/brief-extractor";

const MAX_INPUT_CHARS = 4000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text : "";

    if (!text.trim()) {
      return NextResponse.json({ error: "Describe your promotion first" }, { status: 400 });
    }
    if (text.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        { error: `Keep the description under ${MAX_INPUT_CHARS} characters` },
        { status: 400 },
      );
    }

    const { brief, usedModel } = await extractBrief(text);
    return NextResponse.json({ brief, usedModel });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not read that description";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
