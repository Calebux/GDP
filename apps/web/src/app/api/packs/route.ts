import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pack = await packService.createPack(body);
    return NextResponse.json({ packId: pack.id, pack });
  } catch (err: any) {
    const message = err?.message || "Failed to generate promo pack concepts";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
