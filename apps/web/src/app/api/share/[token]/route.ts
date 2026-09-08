import { NextRequest, NextResponse } from "next/server";
import { packRepository } from "@/lib/pack-repository";
import { trackEvent } from "@/lib/analytics";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const share = await packRepository.getPackShareByToken(token);

    if (!share) {
      return NextResponse.json({ error: "Preview link not found or expired" }, { status: 404 });
    }

    const pack = await packRepository.getPack(share.packId);
    if (!pack) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const concept = pack.concepts.find((c) => c.id === share.conceptId) || pack.concepts[0];
    if (!concept) {
      return NextResponse.json({ error: "Concept not found" }, { status: 404 });
    }

    // Increment share view counter
    await packRepository.incrementShareViews(token);

    await trackEvent({
      type: "share_viewed",
      packId: share.packId,
      conceptId: share.conceptId,
      payload: { token },
    });

    return NextResponse.json({
      title: pack.brief.eventName || pack.brief.title || "Social Promo Campaign",
      description: concept.description || pack.brief.description || "Created with GDP Platform",
      previewUrl: concept.previewUrl,
      thumbnailUrl: concept.thumbnailUrl,
      promotionType: pack.brief.promotionType,
      visualDirection: concept.visualDirection,
      token: share.token,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load share" }, { status: 500 });
  }
}
