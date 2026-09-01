import { z } from "zod";
import { FormatId } from "./document.js";

/** §5 — the short conversational brief, normalised. */
export const DesignBrief = z.object({
  category: z.string().default("church"),
  /** e.g. "sunday-service", "conference", "worship-night" */
  subcategory: z.string().default("sunday-service"),
  /** The occasion: "Valentine's Special", "Grand Opening", "Black Friday". */
  eventTitle: z.string().max(120).default(""),
  /** The promotion itself. For a promo this, not the occasion, is the message. */
  offer: z.string().max(80).default(""),
  offerDetail: z.string().max(120).default(""),
  promoCode: z.string().max(40).default(""),
  /** "nail-salon", "barber", "restaurant"… drives style-direction matching. */
  businessType: z.string().default(""),
  seriesName: z.string().max(120).default(""),
  organisationName: z.string().max(120).default(""),
  date: z.string().max(80).default(""),
  time: z.string().max(80).default(""),
  location: z.string().max(160).default(""),
  people: z
    .array(
      z.object({
        name: z.string().max(80),
        title: z.string().max(80).default(""),
        assetRef: z.string().optional(),
      }),
    )
    .max(6)
    .default([]),
  callToAction: z.string().max(120).default(""),
  website: z.string().max(160).default(""),
  socials: z.string().max(200).default(""),
  extraLines: z.array(z.string().max(160)).max(6).default([]),
  /** §51 — one of the curated visual directions. */
  styleDirection: z.string().default(""),
  /** Free-text feeling when the user does not pick a direction. */
  feeling: z.string().max(400).default(""),
  format: FormatId.default("ig-portrait"),
  brandKitId: z.string().optional(),
  language: z.string().default("en"),
});
export type DesignBrief = z.infer<typeof DesignBrief>;

/** §19 — reusable organisation identity. */
export const BrandKit = z.object({
  id: z.string(),
  name: z.string(),
  logoAssetId: z.string().optional(),
  secondaryLogoAssetId: z.string().optional(),
  colors: z.array(z.string()).max(8).default([]),
  fonts: z.array(z.string()).max(4).default([]),
  organisationName: z.string().default(""),
  address: z.string().default(""),
  website: z.string().default(""),
  socials: z.string().default(""),
  serviceTimes: z.string().default(""),
  disclaimer: z.string().default(""),
  preferredDirection: z.string().default(""),
  /** §46 — learned preferences, updated as the org approves designs. */
  learnedPreferences: z.record(z.string(), z.number()).default({}),
});
export type BrandKit = z.infer<typeof BrandKit>;
