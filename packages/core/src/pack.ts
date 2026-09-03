import { z } from "zod";
import { FORMATS, FormatId } from "@gdp/design-schema";

export const PackFormatItem = z.object({
  id: FormatId,
  name: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  format: z.string().default("png"),
  description: z.string().default(""),
});
export type PackFormatItem = z.infer<typeof PackFormatItem>;

export const PACK_FORMATS: PackFormatItem[] = [
  {
    id: "ig-portrait",
    name: "Instagram Portrait",
    width: FORMATS["ig-portrait"].width,
    height: FORMATS["ig-portrait"].height,
    format: "png",
    description: "4:5 ratio \u2014 highest engagement feed post",
  },
  {
    id: "ig-square",
    name: "Instagram Square",
    width: FORMATS["ig-square"].width,
    height: FORMATS["ig-square"].height,
    format: "png",
    description: "1:1 ratio \u2014 universal social feed post",
  },
  {
    id: "story",
    name: "Instagram Story & WhatsApp Status",
    width: FORMATS["story"].width,
    height: FORMATS["story"].height,
    format: "png",
    description: "9:16 vertical full-screen",
  },
  {
    id: "facebook",
    name: "Facebook Post",
    width: FORMATS["facebook"].width,
    height: FORMATS["facebook"].height,
    format: "png",
    description: "Standard landscape social post",
  },
  {
    id: "x-post",
    name: "X / Twitter Post",
    width: FORMATS["x-post"].width,
    height: FORMATS["x-post"].height,
    format: "png",
    description: "16:9 widescreen timeline graphic",
  },
  {
    id: "youtube-thumb",
    name: "YouTube Thumbnail",
    width: FORMATS["youtube-thumb"].width,
    height: FORMATS["youtube-thumb"].height,
    format: "png",
    description: "High-impact 720p landscape video cover",
  },
  {
    id: "flyer-a5",
    name: "Print Flyer (A5)",
    width: FORMATS["flyer-a5"].width,
    height: FORMATS["flyer-a5"].height,
    format: "pdf",
    description: "300 DPI print-ready document",
  },
];

export const SmartBrief = z.object({
  promotionType: z.string().default("promotion"),
  title: z.string().max(120).default(""),
  description: z.string().max(500).default(""),
  objective: z.string().max(200).default(""),
  targetAudience: z.string().max(200).default(""),
  brandName: z.string().max(120).default(""),
  eventName: z.string().max(120).default(""),
  date: z.string().max(80).default(""),
  time: z.string().max(80).default(""),
  location: z.string().max(160).default(""),
  offer: z.string().max(80).default(""),
  offerDetail: z.string().max(120).default(""),
  promoCode: z.string().max(40).default(""),
  CTA: z.string().max(120).default("Learn More"),
  website: z.string().max(160).default(""),
  phone: z.string().max(40).default(""),
  email: z.string().max(120).default(""),
  socialHandles: z.string().max(200).default(""),
  brandColors: z.array(z.string()).max(6).default([]),
  logo: z.string().optional(),
  images: z.array(z.string()).max(6).default([]),
  requestedFormats: z.array(FormatId).default(["ig-portrait", "ig-square", "story", "facebook"]),
  additionalInstructions: z.string().max(500).default(""),
  styleDirection: z.string().default(""),
  feeling: z.string().max(400).default(""),
});
export type SmartBrief = z.infer<typeof SmartBrief>;

export type ConceptStatus =
  | "generated"
  | "selected"
  | "rejected"
  | "approved"
  | "processing"
  | "completed"
  | "failed";

export interface ConceptPreview {
  id: string;
  title: string;
  description: string;
  visualDirection: string;
  previewUrl: string;
  thumbnailUrl: string;
  vqs: number;
  status: ConceptStatus;
}

export type PackStatus =
  | "created"
  | "generating"
  | "ready"
  | "selected"
  | "paid"
  | "packaging"
  | "packaged"
  | "failed";

export interface Pack {
  id: string;
  userId?: string;
  brief: SmartBrief;
  status: PackStatus;
  concepts: ConceptPreview[];
  selectedConceptId?: string;
  requestedFormats: FormatId[];
  downloadKey?: string;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export interface PackOrder {
  id: string;
  packId: string;
  userId?: string;
  amount: number;
  currency: string;
  provider: "stripe" | "dev";
  providerSessionId: string;
  status: PaymentStatus;
  checkoutUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackManifestFormat {
  id: FormatId;
  name: string;
  width: number;
  height: number;
  file: string;
}

export interface PackManifest {
  packId: string;
  conceptId: string;
  title: string;
  createdAt: string;
  formats: PackManifestFormat[];
  summary: {
    totalFiles: number;
    unwatermarked: boolean;
    license: string;
  };
}
