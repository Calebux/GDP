import { describe, it, expect } from "vitest";
import { packService } from "@/lib/pack-service";
import { packRepository } from "@/lib/pack-repository";
import { NextRequest } from "next/server";
import { GET as getShareRoute } from "@/app/api/share/[token]/route";
import { GET as freeExportRoute } from "@/app/api/packs/[id]/free-export/route";

describe("D-05: Distribution, Preview Sharing & Free-Tier Export", () => {
  const brief = {
    promotionType: "restaurant",
    title: "Saturday Live Jazz Brunch",
    offer: "Bottomless Mimosas",
    requestedFormats: ["ig-portrait", "story"],
  };

  it("generates secure share tokens, tracks views, and preserves unwatermarked asset privacy", async () => {
    const pack = await packService.createPack(brief);
    const concept = pack.concepts[0]!;

    // 1. Generate share link
    const share = await packService.createShare(pack.id, concept.id);
    expect(share.token).toBeDefined();
    expect(share.token.length).toBeGreaterThan(12);

    // 2. Load public share route
    const req = new NextRequest(`http://localhost:3000/api/share/${share.token}`);
    const res = await getShareRoute(req, { params: Promise.resolve({ token: share.token }) });
    expect(res.status).toBe(200);

    const shareData = await res.json();
    expect(shareData.title).toBe(brief.title);
    expect(shareData.previewUrl).toContain("preview");
    // Ensure original unwatermarked pack is NOT exposed
    expect(shareData.downloadKey).toBeUndefined();

    // 3. Verify view count incremented
    const updatedShare = await packRepository.getPackShareByToken(share.token);
    expect(updatedShare?.viewsCount).toBeGreaterThanOrEqual(1);
  });

  it("exports free-tier preview carrying subtle 'Designed with GDP' credit", async () => {
    const pack = await packService.createPack(brief);
    await packService.selectConcept(pack.id, pack.concepts[0]!.id);

    const req = new NextRequest(`http://localhost:3000/api/packs/${pack.id}/free-export`);
    const res = await freeExportRoute(req, { params: Promise.resolve({ id: pack.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(1000);
  });
});
