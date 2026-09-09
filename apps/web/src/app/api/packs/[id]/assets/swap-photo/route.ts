import { NextRequest, NextResponse } from "next/server";
import { packService } from "@/lib/pack-service";
import { packRepository } from "@/lib/pack-repository";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB limit

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const pack = await packRepository.getPack(id);

    if (!pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    const order = await packRepository.getOrderByPackId(id);
    if (!order || order.status !== "paid") {
      return NextResponse.json(
        { error: "Unauthorized: Photo swapping is only available for purchased packs" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // 1. Validate file size
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds 10MB limit (uploaded: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported image format: ${file.type}. Please upload PNG, JPG, or WebP.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Server-side validation of magic bytes
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp =
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";

    if (!isPng && !isJpg && !isWebp) {
      return NextResponse.json(
        { error: "Corrupted or invalid image file content." },
        { status: 400 }
      );
    }

    // 4. Perform photo swap
    const result = await packService.swapPhoto({
      packId: id,
      userId: pack.userId || "anon_user",
      fileBuffer: buffer,
      mimeType: file.type,
      originalFilename: file.name,
    });

    return NextResponse.json({
      success: true,
      message: "Photo swapped successfully. New version generated.",
      version: result.version,
      previewUrl: result.previewUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to process photo swap" },
      { status: 500 }
    );
  }
}
