import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";
import { env } from "@gdp/core";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let conceptId: string | undefined;
    try {
      const body = await req.json();
      conceptId = body?.conceptId;
    } catch {
      // Body optional
    }

    const share = await packService.createShare(id, conceptId);
    const appUrl = env().APP_URL.replace(/\/$/, "");

    return NextResponse.json({
      share,
      shareUrl: `${appUrl}/share/${share.token}`,
      relativeUrl: `/share/${share.token}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create share link" }, { status: 400 });
  }
}
