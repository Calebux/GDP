import type { FormatId } from "@gdp/design-schema";

export interface PackDefinition {
  version: string;
  name: string;
  description: string;
  includedFormats: FormatId[];
  includedAssetCount: number;
  unwatermarked: boolean;
  exportResolutions: {
    rasterScale: number; // 1 = 100% full scale
    pdfDpi: number;      // 300 dpi for print flyers
  };
  entitlements: {
    unlimitedFreeTextCorrections: boolean;
    unlimitedFreeDateTimeCorrections: boolean;
    includedRegenerations: number;
    postPurchasePhotoSwaps: number;
  };
  retention: {
    activeDownloadDays: number;
    archiveDays: number;
  };
}

export const PACK_DEFINITION_V1: PackDefinition = {
  version: "1.0",
  name: "GDP Finished Promo Pack",
  description: "Complete outcome-first promo pack across 8 social, mobile and print channels",
  includedFormats: [
    "ig-portrait",
    "ig-square",
    "story",
    "facebook",
    "x-post",
    "youtube-thumb",
    "flyer-a5",
    "flyer-a4",
  ],
  includedAssetCount: 8,
  unwatermarked: true,
  exportResolutions: {
    rasterScale: 1,
    pdfDpi: 300,
  },
  entitlements: {
    unlimitedFreeTextCorrections: true,
    unlimitedFreeDateTimeCorrections: true,
    includedRegenerations: 3,
    postPurchasePhotoSwaps: 5,
  },
  retention: {
    activeDownloadDays: 90,
    archiveDays: 365,
  },
};

export const CURRENT_PACK_DEFINITION = PACK_DEFINITION_V1;

export function getPackDefinition(version?: string): PackDefinition {
  if (version === "1.0" || !version) {
    return PACK_DEFINITION_V1;
  }
  return PACK_DEFINITION_V1;
}
