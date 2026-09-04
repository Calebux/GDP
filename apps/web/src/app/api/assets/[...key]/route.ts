import { NextRequest, NextResponse } from "next/server";
import { storage } from "@gdp/storage";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  zip: "application/zip",
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await context.params;
    const fullKey = key.join("/");

    // Security: Do not allow direct public serving of protected/ directory
    if (fullKey.startsWith("protected/")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const store = storage();
    const exists = await store.exists(fullKey);
    if (!exists) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const buffer = await store.get(fullKey);
    const ext = fullKey.split(".").pop()?.toLowerCase() || "bin";
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Asset retrieval error" }, { status: 500 });
  }
}
