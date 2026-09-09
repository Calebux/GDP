import JSZip from "jszip";
import { createLogger } from "@gdp/core";
import {
  type Pack,
  type PackManifest,
  type PackManifestFormat,
} from "@gdp/core";
import { FORMATS, type FormatId } from "@gdp/design-schema";
import { resizeCampaign } from "@gdp/layout-engine";
import { renderDocument } from "@gdp/renderer";
import { storage } from "@gdp/storage";
import { packRepository } from "./pack-repository";

const log = createLogger("packaging-service");

export class PackagingService {
  async packagePack(
    packId: string,
    options?: {
      versionNumber?: number;
      label?: string;
      parentVersionId?: string;
      patch?: any;
      editCategory?: string;
    },
  ): Promise<Pack> {
    const pack = await packRepository.getPack(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);

    if (!pack.selectedConceptId) {
      throw new Error(`Pack ${packId} has no concept selected`);
    }

    // Server-side verification of payment before packaging
    const order = await packRepository.getOrderByPackId(packId);
    if (!order || order.status !== "paid") {
      throw new Error(`Unauthorized: Pack ${packId} is not paid`);
    }

    await packRepository.updatePack(packId, { status: "packaging" });

    const stored = await packRepository.getStoredConcept(packId, pack.selectedConceptId);
    if (!stored) {
      throw new Error(`Selected concept ${pack.selectedConceptId} document not found`);
    }

    log.info("Starting multi-format packaging", {
      packId,
      conceptId: pack.selectedConceptId,
      formats: pack.requestedFormats,
    });

    // 1. Recompose document into every requested format without distortion (D-08, D-13)
    const formatsToGenerate = (pack.requestedFormats.length > 0
      ? pack.requestedFormats
      : (["ig-portrait", "ig-square", "story", "facebook"] as FormatId[])
    ).filter((f) => Boolean(FORMATS[f]));

    const campaignDocs = resizeCampaign(stored.doc, [], formatsToGenerate);

    const zip = new JSZip();
    const packFolder = zip.folder("pack") ?? zip;

    const manifestFormats: PackManifestFormat[] = [];

    // 2. Render each format at full resolution with NO watermark
    for (const formatId of formatsToGenerate) {
      const doc = campaignDocs[formatId];
      if (!doc) continue;

      const formatConfig = FORMATS[formatId];
      const isPdf = formatId.startsWith("flyer");
      const ext = isPdf ? "pdf" : "png";
      const mime = isPdf ? "application/pdf" : "image/png";

      const render = await renderDocument(doc, {
        format: ext,
        scale: 1, // full resolution
        watermark: undefined, // UNWATERMARKED
      });

      const fileName = `design.${ext}`;
      const formatFolder = packFolder.folder(formatId);
      if (formatFolder) {
        formatFolder.file(fileName, render.buffer);
      }

      manifestFormats.push({
        id: formatId,
        name: formatConfig.label,
        width: formatConfig.width,
        height: formatConfig.height,
        file: `pack/${formatId}/${fileName}`,
      });
    }

    // 3. Generate manifest.json (D-01)
    const existingVersions = await packRepository.getPackVersions(packId);
    const versionNumber = options?.versionNumber ?? (existingVersions.length > 0 ? existingVersions.length + 1 : 1);
    const label = options?.label || (versionNumber === 1 ? "Original Design" : `Version ${versionNumber}`);

    const manifest: PackManifest = {
      packId,
      conceptId: pack.selectedConceptId,
      title: pack.brief.eventName || pack.brief.title || "Social Promo Pack",
      version: versionNumber,
      createdAt: new Date().toISOString(),
      formats: manifestFormats,
      summary: {
        totalFiles: manifestFormats.length,
        unwatermarked: true,
        license: "Commercial & Personal Single Promo Pack License",
      },
    };

    packFolder.file("manifest.json", JSON.stringify(manifest, null, 2));

    // 4. Generate ZIP archive
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    // 5. Store zip in storage under protected key
    const store = storage();
    const downloadKey = `protected/packs/${packId}/pack_v${versionNumber}.zip`;
    await store.put({
      key: downloadKey,
      body: zipBuffer,
      contentType: "application/zip",
      extension: "zip",
    });

    // Also update current pack.zip pointer
    await store.put({
      key: `protected/packs/${packId}/pack.zip`,
      body: zipBuffer,
      contentType: "application/zip",
      extension: "zip",
    });

    log.info("Finished packaging pack", {
      packId,
      versionNumber,
      zipBytes: zipBuffer.byteLength,
      filesCount: manifestFormats.length,
    });

    // Save pack version record
    await packRepository.savePackVersion({
      id: `ver_${packId}_${versionNumber}`,
      packId,
      versionNumber,
      parentVersionId: options?.parentVersionId,
      conceptId: pack.selectedConceptId,
      label,
      document: stored.doc,
      patch: options?.patch,
      editCategory: options?.editCategory,
      previewKey: stored.preview.previewUrl,
      downloadKey,
      downloadUrl: `/api/packs/${packId}/download?version=${versionNumber}`,
      createdAt: new Date().toISOString(),
    });

    const updated = await packRepository.updatePack(packId, {
      status: "packaged",
      downloadKey: `protected/packs/${packId}/pack.zip`,
      downloadUrl: `/api/packs/${packId}/download`,
    });

    return updated!;
  }
}

export const packagingService = new PackagingService();
