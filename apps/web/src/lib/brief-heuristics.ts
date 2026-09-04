import { z } from "zod";
import { type PromotionCategory } from "@gdp/core";

/**
 * Dependency-free half of brief extraction, so the client can share the
 * keyword rules without pulling the LLM SDKs into the browser bundle.
 */

/**
 * The fields a model may fill from free text. Deliberately narrower than
 * SmartBrief: formats, style and the pack's own settings stay the customer's
 * choice, and nothing here is invented — absent facts come back as "".
 */
export const BriefExtraction = z.object({
  promotionType: z.enum(["promotion", "church", "event"]),
  businessType: z.string(),
  title: z.string(),
  brandName: z.string(),
  offer: z.string(),
  offerDetail: z.string(),
  promoCode: z.string(),
  date: z.string(),
  time: z.string(),
  location: z.string(),
  CTA: z.string(),
  website: z.string(),
  feeling: z.string(),
});
export type BriefExtraction = z.infer<typeof BriefExtraction>;

/**
 * Church words must be specific. "sunday" and "service" match a cafe that
 * opens at the weekend, and mislabelling the category also blanks businessType,
 * which is what picks the design direction.
 */
const CATEGORY_HINTS: Array<[PromotionCategory, string[]]> = [
  ["church", ["church", "ministry", "worship", "gospel", "chapel", "congregation", "sermon", "pastor", "bible study"]],
  ["event", ["concert", "festival", "conference", "gig", "fundraiser", "live show"]],
];

const BUSINESS_HINTS: Array<[string, string[]]> = [
  ["restaurant", ["restaurant", "diner", "kitchen", "brunch", "menu", "taco", "pizza", "grill"]],
  ["cafe", ["cafe", "café", "coffee", "espresso", "roastery"]],
  ["bakery", ["bakery", "pastry", "bread", "patisserie"]],
  ["bar", ["bar", "pub", "cocktail", "brewery", "happy hour"]],
  ["nail-salon", ["nail", "manicure", "pedicure"]],
  ["spa", ["spa", "massage", "facial", "wellness"]],
  ["hair-salon", ["hair", "salon", "blowout", "stylist"]],
  ["barber", ["barber", "fade", "shave"]],
  ["gym", ["gym", "fitness", "workout", "bootcamp"]],
  ["yoga", ["yoga", "pilates"]],
  ["boutique", ["boutique", "clothing", "apparel", "fashion"]],
  ["retail", ["shop", "store", "sale", "storewide", "retail"]],
];

/**
 * A headline, not a sentence. Without a model the best available guess is the
 * opening clause, trimmed at a word boundary — the customer edits it after.
 */
function headlineFrom(text: string): string {
  const firstSentence = text.split(/[\n.!?]/)[0]?.trim() ?? "";
  const clause = firstSentence.split(/,|\bat\b|\bon\b/)[0]?.trim() ?? firstSentence;
  const candidate = clause.length >= 8 ? clause : firstSentence;
  if (candidate.length <= 60) return candidate;
  return candidate.slice(0, 60).replace(/\s+\S*$/, "").trim();
}

function firstHit(text: string, table: Array<[string, string[]]>): string {
  for (const [value, words] of table) {
    if (words.some((w) => text.includes(w))) return value;
  }
  return "";
}

/**
 * Keyword extraction — what runs when no LLM is configured (LLM_PROVIDER
 * defaults to "mock", so this is the default path). It only sets what it can
 * defend from the text; everything else stays blank for the customer to fill.
 */
export function extractHeuristically(text: string): BriefExtraction {
  const lower = text.toLowerCase();

  // Business type is decided on its own evidence. A named trade means this is
  // a business promoting itself, whatever else the text mentions.
  const businessType = firstHit(lower, BUSINESS_HINTS);
  const matched = CATEGORY_HINTS.find(([, words]) => words.some((w) => lower.includes(w)))?.[0];
  const category: PromotionCategory =
    matched === "church" ? "church" : businessType ? "promotion" : (matched ?? "promotion");

  const percentOff = /(\d{1,3})\s*%\s*(off|discount)/i.exec(text);
  const amountOff = /(\$\d+(?:\.\d{2})?)\s*(off|deal|special)?/i.exec(text);
  const offer = percentOff
    ? `${percentOff[1]}% OFF`
    : amountOff
      ? amountOff[0].trim().toUpperCase()
      : "";

  return {
    promotionType: category,
    businessType: category === "church" ? "" : businessType,
    title: headlineFrom(text),
    brandName: "",
    offer,
    offerDetail: "",
    promoCode: /\b(code|promo)\s*[:\-]?\s*([A-Z0-9]{3,})/i.exec(text)?.[2] ?? "",
    date: "",
    time: "",
    location: "",
    CTA: "",
    website: /\b([a-z0-9-]+\.(?:com|co|org|net|shop|store|io))\b/i.exec(text)?.[1] ?? "",
    feeling: "",
  };
}

