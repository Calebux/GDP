import { NextRequest, NextResponse } from "next/server";
import { storage } from "@gdp/storage";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

/**
 * Prefixes this route may serve. An allowlist, not a "protected/" denylist:
 * a denylist has to be right about every way a key can be spelled, and a key
 * like "../protected/…" does not start with "protected/" but still resolves
 * there once the storage driver normalises it. Paid artefacts are served only
 * by /api/packs/[id]/download, behind the order check.
 */
const PUBLIC_PREFIXES = ["previews/", "uploads/"];

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await context.params;

    // Reject traversal and absolute paths before the key reaches storage,
    // rather than relying on the driver to sanitise them.
    if (
      key.length === 0 ||
      key.some((segment) => segment === "" || segment === "." || segment === ".." || /[\\\0]/.test(segment))
    ) {
      return NextResponse.json({ error: "Invalid asset key" }, { status: 400 });
    }

    const fullKey = key.join("/");
    if (!PUBLIC_PREFIXES.some((prefix) => fullKey.startsWith(prefix))) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const ext = fullKey.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME_TYPES[ext];
    if (!contentType) {
      return NextResponse.json({ error: "Unsupported asset type" }, { status: 403 });
    }

    const store = storage();
    if (!(await store.exists(fullKey))) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const buffer = await store.get(fullKey);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset retrieval error" }, { status: 500 });
  }
}
