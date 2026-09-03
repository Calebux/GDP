import { NextRequest, NextResponse } from "next/server";
import { packRepository } from "@/lib/pack-repository";
import { packagingService } from "@/lib/packaging-service";
import { storage } from "@gdp/storage";

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

    // Strict server-side verification: check order payment status
    const order = await packRepository.getOrderByPackId(id);
    if (!order || order.status !== "paid") {
      return NextResponse.json(
        { error: "Payment required. You must unlock this pack before downloading." },
        { status: 403 }
      );
    }

    // If pack is paid but not yet packaged, package it now
    let currentPack = pack;
    if (currentPack.status !== "packaged" || !currentPack.downloadKey) {
      currentPack = await packagingService.packagePack(id);
    }

    if (!currentPack.downloadKey) {
      return NextResponse.json(
        { error: "Pack archive is not ready yet" },
        { status: 500 }
      );
    }

    const store = storage();
    const zipBuffer = await store.get(currentPack.downloadKey);

    const safeTitle = (pack.brief.eventName || pack.brief.title || "promo-pack")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}-${pack.id}.zip"`,
        "Content-Length": zipBuffer.byteLength.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Download failed" }, { status: 500 });
  }
}
