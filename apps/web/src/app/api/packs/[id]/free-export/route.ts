import { NextRequest, NextResponse } from "next/server";
import { packRepository } from "@/lib/pack-repository";
import { renderDocument } from "@gdp/renderer";
import { trackEvent } from "@/lib/analytics";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const pack = await packRepository.getPack(id);
    if (!pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    const conceptId = pack.selectedConceptId || pack.concepts[0]?.id;
    if (!conceptId) {
      return NextResponse.json({ error: "No concept selected" }, { status: 400 });
    }

    const stored = await packRepository.getStoredConcept(id, conceptId);
    if (!stored) {
      return NextResponse.json({ error: "Concept document not found" }, { status: 404 });
    }

    // Render at preview resolution with subtle tasteful brand credit (D-05)
    const render = await renderDocument(stored.doc, {
      format: "png",
      scale: 0.6,
      watermark: "Designed with GDP",
    });

    await trackEvent({
      type: "free_export_downloaded",
      packId: id,
      conceptId,
    });

    return new NextResponse(render.buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="promo_preview_gdp.png"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to generate free export" }, { status: 500 });
  }
}
